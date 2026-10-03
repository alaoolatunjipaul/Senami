/**
 * AI governance service (Phase 10, sections 3, 5 and 27).
 *
 * Turns the pure rules in `lib/domain/ai-governance` into the envelope the
 * assistant returns to a client and the audit trail records. It is the only
 * place that decides *what backs a given reply*:
 *
 *   interaction intent -> knowledge article -> AiSource -> grounding state
 *
 * Keeping source selection here means a reply's trustworthiness is decided by
 * the server from data we control, never by a model claiming something about
 * itself.
 */

import {
  ACTION_RISK_LABELS,
  AI_ACTION_RISK,
  AI_RESPONSE_STATE_META,
  DEFAULT_AI_POLICY,
  assessActionRisk,
  confidenceBand,
  evaluateGrounding,
  scanForSensitiveData,
  type ActionRiskLevel,
  type AiGovernanceEnvelope,
  type AiPolicy,
  type AiProvenance,
  type AiResponseState,
  type AiSource,
  type GroundingAssessment,
} from "@/lib/domain/ai-governance";
import type { AiAction } from "@/lib/domain/ai";
import type { Intent } from "@/lib/domain/taxonomy";
import { articleForIntent, searchArticles, type KnowledgeArticle } from "@/lib/domain/knowledge";

/** Deployment name shown in provenance instead of a vendor model name. */
export const AI_MODEL_NAME = "senami-assistant";

export interface GovernedAiDraft {
  readonly action: AiAction;
  readonly intent: Intent;
  readonly content: string;
  readonly confidence: number;
  /** Interaction is escalated, so the assistant must not offer to send. */
  readonly escalated: boolean;
}

/** JSON-safe governance envelope. This is what the client and the audit see. */
export type { AiGovernanceEnvelope };

export interface GroundedDraft {
  readonly envelope: AiGovernanceEnvelope;
  readonly provenance: AiProvenance;
}

function articleToSource(article: KnowledgeArticle): AiSource {
  return {
    id: article.id,
    title: article.title,
    kind: "knowledge_article",
    version: article.version,
    reviewedAt: article.reviewedAt,
  };
}

/**
 * The sources that back a reply.
 *
 * The article for the interaction's intent is the primary source. When there is
 * none, each meaningful word of the customer's own message is looked up
 * separately and the strongest hit is used as a weaker fallback. Terms are
 * searched one at a time on purpose: searching the whole sentence as a single
 * string matches nothing in a keyword index.
 *
 * When neither route finds anything the result is an empty list, which grounding
 * reports as `no_source` - the honest outcome rather than a vague disclaimer.
 */
export function sourcesFor(draft: GovernedAiDraft): AiSource[] {
  const primary = articleForIntent(draft.intent);
  if (primary) return [articleToSource(primary)];

  const terms = draft.content
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 4);

  for (const term of terms) {
    const hit = searchArticles(term, 1)[0];
    if (hit) return [articleToSource(hit)];
  }
  return [];
}

function riskLabel(risk: ActionRiskLevel): string {
  return ACTION_RISK_LABELS[risk];
}

function stateMeta(state: AiResponseState) {
  return AI_RESPONSE_STATE_META[state];
}

/** Run the policy gates and grounding rules, and package the result. */
export function governDraft(
  draft: GovernedAiDraft,
  policy: AiPolicy = DEFAULT_AI_POLICY,
  now: Date = new Date(),
): GroundedDraft {
  const sources = sourcesFor(draft);
  const risk = AI_ACTION_RISK[draft.action];
  const band = confidenceBand(draft.confidence);

  const assessment: GroundingAssessment = evaluateGrounding({
    action: draft.action,
    intent: draft.intent,
    confidence: draft.confidence,
    sources,
    escalated: draft.escalated,
    risk,
    policy,
  });
  const meta = stateMeta(assessment.state);

  const provenance: AiProvenance = {
    model: AI_MODEL_NAME,
    capability: draft.action,
    policyVersion: policy.version,
    generatedAt: now.toISOString(),
    confidence: {
      score: draft.confidence,
      band,
      basis:
        sources.length > 0
          ? `Approved knowledge match for ${draft.intent.replace(/_/g, " ")}.`
          : "No knowledge source was found for this interaction.",
    },
    sources,
    review: "unreviewed",
  };

  const envelope: AiGovernanceEnvelope = {
    state: assessment.state,
    stateLabel: meta.label,
    tone: meta.tone,
    guidance: meta.guidance,
    band: assessment.band,
    confidence: draft.confidence,
    mode: policy.mode,
    model: provenance.model,
    policyVersion: policy.version,
    generatedAt: provenance.generatedAt,
    review: provenance.review,
    risk,
    riskLabel: riskLabel(risk),
    requiresApproval: assessActionRisk(risk, policy).requiresApproval,
    canSendUnchanged: !assessment.requiresApproval,
    sources,
    conditions: assessment.conditions,
    sensitiveData: scanForSensitiveData(draft.content),
  };

  return { envelope, provenance };
}