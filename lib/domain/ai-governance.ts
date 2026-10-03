/**
 * Responsible AI governance (Phase 10, sections 3, 5 and 27).
 *
 * This module owns the rules that decide whether the assistant may help, whether
 * a given reply is trustworthy enough to send, and who has to approve an action
 * that commits the bank. It is pure and has no store or provider dependency, so
 * the same rules are enforced by the server, asserted in tests and shown to an
 * administrator on the governance screen.
 *
 * Three deliberate constraints shape the design:
 *
 *  1. **No chain of thought.** Provenance carries business facts - model,
 *     capability, sources and versions, policy version, timestamp, a banded
 *     confidence signal and review status. It never carries reasoning. A test
 *     enforces that the provenance shape stays reasoning-free, so adding a
 *     "thoughts" field later fails loudly instead of leaking model internals
 *     into the audit trail.
 *  2. **No fabricated authority.** Grounding is derived from sources that were
 *     actually found, never from a guess. With no source the state is
 *     `no_source`, not a lower-confidence `grounded`.
 *  3. **Humans stay accountable.** The assistant produces drafts. High-risk
 *     commitments require an explicit, recorded approval, and `auto` mode still
 *     cannot send them.
 */

import type { AiAction } from "@/lib/domain/ai";
import type { Intent } from "@/lib/domain/taxonomy";
import type { Tone } from "@/lib/domain/taxonomy";

/* -------------------------------------------------------------------------
   Operating mode
   ------------------------------------------------------------------------- */

/**
 * `assisted` - the assistant proposes, the agent decides.
 * `auto` - the assistant may also act on low-risk work without a prompt.
 *
 * Mode never removes the approval requirement for high-risk commitments.
 */
export const AI_MODES = ["assisted", "auto"] as const;
export type AiMode = (typeof AI_MODES)[number];

export const AI_MODE_LABELS: Record<AiMode, string> = {
  assisted: "Assisted",
  auto: "Auto-assisted",
};

export const AI_MODE_DESCRIPTIONS: Record<AiMode, string> = {
  assisted: "The assistant proposes; an agent reviews and sends.",
  auto: "The assistant may handle low-risk work directly, within policy.",
};

/* -------------------------------------------------------------------------
   Response states
   ------------------------------------------------------------------------- */

/**
 * The states an assistant response can be in. These are the only words the
 * product uses to describe trustworthiness - there is no vague "AI says" badge.
 */
export const AI_RESPONSE_STATES = [
  "grounded",
  "needs_verification",
  "low_confidence",
  "no_source",
  "escalation_required",
  "human_approval_required",
] as const;
export type AiResponseState = (typeof AI_RESPONSE_STATES)[number];

export interface AiResponseStateMeta {
  readonly label: string;
  readonly tone: Tone;
  /** Shown to the agent; explains what to do, not why the model decided. */
  readonly guidance: string;
  /** Whether this state stops the reply being sent without extra steps. */
  readonly blocksSend: boolean;
}

export const AI_RESPONSE_STATE_META: Record<AiResponseState, AiResponseStateMeta> = {
  grounded: {
    label: "Grounded",
    tone: "success",
    guidance: "Backed by an approved source. Review as normal and send.",
    blocksSend: false,
  },
  needs_verification: {
    label: "Needs verification",
    tone: "warning",
    guidance: "Check the cited source before sending.",
    blocksSend: false,
  },
  low_confidence: {
    label: "Low confidence",
    tone: "warning",
    guidance: "The assistant is unsure. Rewrite it yourself or ask a supervisor.",
    blocksSend: false,
  },
  no_source: {
    label: "No source",
    tone: "critical",
    guidance: "Nothing in the knowledge base backs this. Do not send it as-is.",
    blocksSend: true,
  },
  escalation_required: {
    label: "Escalation required",
    tone: "critical",
    guidance: "This interaction is escalated. Handle it under the escalation policy.",
    blocksSend: true,
  },
  human_approval_required: {
    label: "Human approval required",
    tone: "critical",
    guidance: "This commits the bank. A supervisor must approve it before sending.",
    blocksSend: true,
  },
};

/* -------------------------------------------------------------------------
   Confidence
   ------------------------------------------------------------------------- */

/**
 * Confidence is reported as a band, never as a precise probability. A number
 * like "0.73" implies a calibration the deterministic engine does not have and
 * agents would read as fact.
 */
export const CONFIDENCE_BANDS = ["high", "medium", "low"] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export const CONFIDENCE_THRESHOLDS = { medium: 0.6, high: 0.8 } as const;

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export const CONFIDENCE_BAND_TONES: Record<ConfidenceBand, Tone> = {
  high: "success",
  medium: "warning",
  low: "critical",
};

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (score >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

/* -------------------------------------------------------------------------
   Sources
   ------------------------------------------------------------------------- */

export const AI_SOURCE_KINDS = [
  "knowledge_article",
  "policy",
  "interaction",
  "customer_record",
] as const;
export type AiSourceKind = (typeof AI_SOURCE_KINDS)[number];

export const AI_SOURCE_KIND_LABELS: Record<AiSourceKind, string> = {
  knowledge_article: "Knowledge article",
  policy: "Policy",
  interaction: "Previous interaction",
  customer_record: "Customer record",
};

export interface AiSource {
  readonly id: string;
  readonly title: string;
  readonly kind: AiSourceKind;
  /** Document version or last-reviewed stamp; absence means "not versioned". */
  readonly version: string | null;
  readonly reviewedAt: string | null;
}

/**
 * A source only counts as approved when it is versioned and has a review date.
 * An unversioned document is exactly the thing that goes stale silently.
 */
export function isApprovedSource(source: AiSource): boolean {
  return source.version !== null && source.reviewedAt !== null;
}

/* -------------------------------------------------------------------------
   Provenance
   ------------------------------------------------------------------------- */

export const AI_REVIEW_STATUSES = [
  "unreviewed",
  "agent_accepted",
  "agent_edited",
  "supervisor_sampled",
] as const;
export type AiReviewStatus = (typeof AI_REVIEW_STATUSES)[number];

export const AI_REVIEW_STATUS_LABELS: Record<AiReviewStatus, string> = {
  unreviewed: "Not reviewed",
  agent_accepted: "Accepted by agent",
  agent_edited: "Edited by agent",
  supervisor_sampled: "Sampled by supervisor",
};

export interface AiProvenance {
  /** Model that produced the text, e.g. a deployment name. */
  readonly model: string;
  /** Which assistant capability ran. */
  readonly capability: AiAction;
  /** Version of the policy in force when this was produced. */
  readonly policyVersion: string;
  readonly generatedAt: string;
  readonly confidence: {
    readonly score: number;
    readonly band: ConfidenceBand;
    /** What the score is measured against, in business terms. */
    readonly basis: string;
  };
  readonly sources: readonly AiSource[];
  readonly review: AiReviewStatus;
}

/** Field names that must never appear in provenance. See the module comment. */
export const FORBIDDEN_PROVENANCE_FIELDS = [
  "reasoning",
  "thoughts",
  "chainOfThought",
  "rationale",
  "internalMonologue",
] as const;

export function hasForbiddenProvenanceFields(provenance: AiProvenance): string[] {
  const keys = Object.keys(provenance).map((key) => key.toLowerCase());
  return FORBIDDEN_PROVENANCE_FIELDS.filter((forbidden) =>
    keys.some((key) => key.includes(forbidden.toLowerCase())),
  );
}

/* -------------------------------------------------------------------------
   Action risk
   ------------------------------------------------------------------------- */

export const ACTION_RISK_LEVELS = ["low", "medium", "high"] as const;
export type ActionRiskLevel = (typeof ACTION_RISK_LEVELS)[number];

export const ACTION_RISK_LABELS: Record<ActionRiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export const ACTION_RISK_TONES: Record<ActionRiskLevel, Tone> = {
  low: "success",
  medium: "warning",
  high: "critical",
};

/**
 * Customer commitments that change the bank's position. These are the actions a
 * contact centre is judged on, so their risk is about consequence, not about how
 * hard they are to describe.
 */
export const CUSTOMER_COMMITMENT_ACTIONS = [
  "share_account_detail",
  "confirm_transaction",
  "issue_refund",
  "waive_fee",
  "offer_goodwill",
  "change_account_terms",
  "close_account",
] as const;
export type CustomerCommitmentAction = (typeof CUSTOMER_COMMITMENT_ACTIONS)[number];

export interface CommitmentRiskMeta {
  readonly label: string;
  readonly risk: ActionRiskLevel;
  /** Permission that must be held to perform the action at all. */
  readonly permission: string;
  /** Whether the assistant may draft it. It may never perform it. */
  readonly aiMayDraft: boolean;
  readonly rationale: string;
}

export const COMMITMENT_ACTION_META: Record<CustomerCommitmentAction, CommitmentRiskMeta> = {
  share_account_detail: {
    label: "Share account detail",
    risk: "high",
    permission: "conversation.reply",
    aiMayDraft: false,
    rationale: "Account data is confidential; it must be read from the system, never inferred.",
  },
  confirm_transaction: {
    label: "Confirm a transaction",
    risk: "high",
    permission: "conversation.reply",
    aiMayDraft: false,
    rationale: "Confirming a movement of money is an authoritative statement.",
  },
  issue_refund: {
    label: "Issue a refund",
    risk: "high",
    permission: "supervisor.escalate",
    aiMayDraft: false,
    rationale: "A refund changes the ledger and must be authorised by a person.",
  },
  waive_fee: {
    label: "Waive a fee",
    risk: "high",
    permission: "supervisor.escalate",
    aiMayDraft: false,
    rationale: "Waiving a charge is a commercial commitment.",
  },
  offer_goodwill: {
    label: "Offer goodwill",
    risk: "medium",
    permission: "conversation.reply",
    aiMayDraft: false,
    rationale: "An offer can create an expectation; it needs a named owner.",
  },
  change_account_terms: {
    label: "Change account terms",
    risk: "high",
    permission: "supervisor.escalate",
    aiMayDraft: false,
    rationale: "Terms changes affect the customer relationship and carry regulatory duty.",
  },
  close_account: {
    label: "Close an account",
    risk: "high",
    permission: "conversation.escalate",
    aiMayDraft: false,
    rationale: "Account closure is irreversible from the contact centre.",
  },
};

/** Risk of each assistant capability. Drafting wording is never high risk. */
export const AI_ACTION_RISK: Record<AiAction, ActionRiskLevel> = {
  summarize: "low",
  suggest: "medium",
  rewrite: "medium",
  shorter: "medium",
  professional: "medium",
  friendlier: "medium",
  extract_intent: "low",
  next_action: "medium",
};

export interface ActionRiskDecision {
  readonly risk: ActionRiskLevel;
  readonly requiresApproval: boolean;
  /** Whether `auto` mode may act on this without prompting an agent. */
  readonly autoModePermitted: boolean;
  readonly rationale: string;
}

/**
 * Decide the risk posture for an action under a policy.
 *
 * `autoModePermitted` is false for anything medium or high: automatic handling
 * is a convenience for low-risk work, never a way around a person.
 */
export function assessActionRisk(
  risk: ActionRiskLevel,
  policy: AiPolicy,
): ActionRiskDecision {
  const requiresApproval =
    policy.requiresApprovalFor.includes(risk) || risk === "high";
  return {
    risk,
    requiresApproval,
    autoModePermitted: risk === "low" && policy.mode === "auto",
    rationale: requiresApproval
      ? `${ACTION_RISK_LABELS[risk]} actions need a recorded human approval.`
      : `${ACTION_RISK_LABELS[risk]} actions can be handled inside policy.`,
  };
}

/* -------------------------------------------------------------------------
   Policy
   ------------------------------------------------------------------------- */

export interface AiPolicy {
  readonly version: string;
  readonly mode: AiMode;
  readonly enabledActions: readonly AiAction[];
  /** Intents the assistant refuses outright, whatever the mode. */
  readonly blockedIntents: readonly Intent[];
  readonly requiresApprovalFor: readonly ActionRiskLevel[];
  /** Mask card numbers and account identifiers before anything is sent upstream. */
  readonly redactSensitiveData: boolean;
  /** A low-confidence response is escalated rather than offered silently. */
  readonly escalateOnLowConfidence: boolean;
  /** Whether approved replies may be proposed for reuse. */
  readonly shareReviewedSuggestions: boolean;
}

export const DEFAULT_AI_POLICY: AiPolicy = {
  version: "2026.10.1",
  mode: "assisted",
  enabledActions: [
    "summarize",
    "suggest",
    "rewrite",
    "shorter",
    "professional",
    "friendlier",
    "extract_intent",
    "next_action",
  ],
  blockedIntents: [],
  requiresApprovalFor: ["high"],
  redactSensitiveData: true,
  escalateOnLowConfidence: false,
  shareReviewedSuggestions: false,
};

export interface PolicyDecision {
  readonly allowed: boolean;
  /** Business-readable; never model reasoning. */
  readonly reason: string;
}

export function canUseAiAction(policy: AiPolicy, action: AiAction): PolicyDecision {
  if (!policy.enabledActions.includes(action)) {
    return { allowed: false, reason: "This capability is switched off by AI policy." };
  }
  return { allowed: true, reason: "Permitted by AI policy." };
}

export function canAssistIntent(policy: AiPolicy, intent: Intent): PolicyDecision {
  if (policy.blockedIntents.includes(intent)) {
    return {
      allowed: false,
      reason: "AI assistance is disabled for this type of interaction.",
    };
  }
  return { allowed: true, reason: "Permitted by AI policy." };
}

/* -------------------------------------------------------------------------
   Sensitive data
   ------------------------------------------------------------------------- */

export const SENSITIVE_DATA_PATTERNS = [
  { kind: "card_number", pattern: /\b(?:\d[ -]?){13,19}\b/g },
  { kind: "account_identifier", pattern: /\b\d{8,}\b/g },
] as const;

export type SensitiveDataKind = (typeof SENSITIVE_DATA_PATTERNS)[number]["kind"];

export const SENSITIVE_DATA_KIND_LABELS: Record<SensitiveDataKind, string> = {
  card_number: "Card number",
  account_identifier: "Account identifier",
};

export interface SensitiveDataFinding {
  readonly kind: SensitiveDataKind;
  /** Masked form; the raw value never leaves this function. */
  readonly masked: string;
  readonly label: string;
}

/** Keep the last four digits, which is what an agent legitimately needs. */
export function maskValue(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "•".repeat(digits.length);
  return `${"•".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/**
 * Scan outbound AI input for data that must not leave the contact centre.
 * Deliberately conservative: a false positive costs an agent a redaction, a
 * false negative leaks customer data.
 */
export function scanForSensitiveData(text: string): SensitiveDataFinding[] {
  const findings: SensitiveDataFinding[] = [];
  for (const { kind, pattern } of SENSITIVE_DATA_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      findings.push({
        kind,
        masked: maskValue(match[0]),
        label: SENSITIVE_DATA_KIND_LABELS[kind],
      });
    }
  }
  return findings;
}

/* -------------------------------------------------------------------------
   Grounding
   ------------------------------------------------------------------------- */

export interface GroundingInput {
  readonly action: AiAction;
  readonly intent: Intent;
  readonly confidence: number;
  readonly sources: readonly AiSource[];
  readonly escalated: boolean;
  readonly risk: ActionRiskLevel;
  readonly policy: AiPolicy;
}

export interface GroundingAssessment {
  readonly state: AiResponseState;
  /** Business-readable conditions, safe to show an agent or log. */
  readonly conditions: readonly string[];
  readonly band: ConfidenceBand;
  readonly approvedSourceCount: number;
  readonly requiresApproval: boolean;
}

/**
 * Derive the response state.
 *
 * Precedence is deliberate: escalation and approval outrank confidence, because
 * those are facts about the interaction rather than estimates about the text.
 */
export function evaluateGrounding(input: GroundingInput): GroundingAssessment {
  const band = confidenceBand(input.confidence);
  const approved = input.sources.filter(isApprovedSource);
  const conditions: string[] = [];

  let state: AiResponseState;

  if (input.escalated) {
    state = "escalation_required";
    conditions.push("The interaction is escalated.");
  } else if (assessActionRisk(input.risk, input.policy).requiresApproval) {
    state = "human_approval_required";
    conditions.push("The action commits the bank and needs a recorded approval.");
  } else if (approved.length === 0) {
    state = "no_source";
    conditions.push(
      input.sources.length === 0
        ? "No knowledge source backs this reply."
        : "The available sources have no version or review date.",
    );
  } else if (band === "low" || (input.policy.escalateOnLowConfidence && band !== "high")) {
    state = "low_confidence";
    conditions.push("The assistant rated its own confidence as low.");
  } else if (band !== "high" || approved.length < input.sources.length) {
    state = "needs_verification";
    conditions.push("At least one source needs checking before this is sent.");
  } else {
    state = "grounded";
    conditions.push("Every source is versioned and reviewed.");
  }

  return {
    state,
    conditions,
    band,
    approvedSourceCount: approved.length,
    requiresApproval: AI_RESPONSE_STATE_META[state].blocksSend,
  };
}

/** Whether a response in this state may be sent as it stands. */
export function canSendUnchanged(state: AiResponseState): boolean {
  return !AI_RESPONSE_STATE_META[state].blocksSend;
}

/* -------------------------------------------------------------------------
   The wire envelope
   ------------------------------------------------------------------------- */

/**
 * Everything the client needs to describe one governed draft.
 *
 * This lives in the domain rather than the server because it is a contract
 * between the two: the server fills it in, the panel renders it, and the same
 * fields are recorded in the audit trail. `tone` is typed as `Tone` so the
 * panel cannot invent a colour for a state that has none.
 */
export interface AiGovernanceEnvelope {
  readonly state: AiResponseState;
  readonly stateLabel: string;
  readonly tone: Tone;
  readonly guidance: string;
  readonly band: ConfidenceBand;
  /** Raw score, kept for the audit trail. The UI shows the band, not this. */
  readonly confidence: number;
  readonly mode: AiMode;
  readonly model: string;
  readonly policyVersion: string;
  readonly generatedAt: string;
  readonly review: AiReviewStatus;
  readonly risk: ActionRiskLevel;
  readonly riskLabel: string;
  readonly requiresApproval: boolean;
  readonly canSendUnchanged: boolean;
  readonly sources: readonly AiSource[];
  /** Business-readable conditions. Never model reasoning. */
  readonly conditions: readonly string[];
  /** Masked only; raw values never leave the scan. */
  readonly sensitiveData: readonly SensitiveDataFinding[];
}