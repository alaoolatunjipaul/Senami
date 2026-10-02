import type { AuditEvent } from "@/lib/domain/conversation";
import { ESCALATION_REASONS, type EscalationReason } from "@/lib/domain/conversation";
import type { InboxConversation } from "@/lib/domain/inbox";
import type { EscalationDetail } from "@/lib/domain/escalation";
import type {
  QaCheckResults,
  QaDecision,
  QaReviewDetail,
  QaReviewTrigger,
} from "@/lib/domain/qa-review";

/**
 * Supervisor ledgers.
 *
 * Escalations and QA reviews carry two kinds of fact. The *live* fact - is this
 * conversation escalated, does it need review - already lives on the conversation
 * record, and the conversation store is the only writer of it. The *contextual*
 * fact - why it was escalated, what the reviewer answered - exists nowhere else,
 * so it lives in these ledgers.
 *
 * The ledgers therefore never restate status. A seeded entry is derived from the
 * conversation on every read, and an explicit outcome is layered on top. That way
 * resolving a conversation removes it from the board immediately without the
 * supervisor store having to be told, and no stale flag can survive a reload.
 */

export interface LedgerEntry<T> {
  readonly conversationId: string;
  readonly detail: T;
}

function asEscalationReason(value: unknown): EscalationReason {
  return typeof value === "string" && (ESCALATION_REASONS as readonly string[]).includes(value)
    ? (value as EscalationReason)
    : "other";
}

/**
 * Derive escalation context from each conversation's own audit trail.
 *
 * The `escalated` audit event already records who escalated, when, and why, so the
 * ledger reads real history rather than inventing it. The note is not recovered
 * because it was stored as an internal note message, not as audit metadata - the
 * conversation itself still holds it.
 */
export function seedEscalationLedger(
  conversations: readonly InboxConversation[],
  auditFor: (conversationId: string) => readonly AuditEvent[],
): readonly EscalationDetail[] {
  const details: EscalationDetail[] = [];

  for (const conversation of conversations) {
    if (conversation.status !== "escalated") continue;

    const event = [...auditFor(conversation.id)]
      .reverse()
      .find((candidate) => candidate.type === "escalated");

    details.push({
      conversationId: conversation.id,
      reason: asEscalationReason(event?.metadata?.reason),
      note: "",
      escalatedById: "",
      escalatedByName: event?.actor ?? "Unknown",
      escalatedAt: event?.createdAt ?? conversation.lastMessageAt,
      outcome: null,
      resolvedAt: null,
      resolvedById: null,
      resolvedByName: null,
      resolutionNote: "",
    });
  }

  return details;
}

/**
 * Derive QA review context for conversations flagged `needsReview`.
 *
 * An item whose thread contains an AI suggestion is reported as an AI draft, which
 * is the thing a reviewer most needs to know before opening it.
 */
export function seedQaLedger(
  conversations: readonly InboxConversation[],
  auditFor: (conversationId: string) => readonly AuditEvent[],
): readonly QaReviewDetail[] {
  const details: QaReviewDetail[] = [];

  for (const conversation of conversations) {
    if (!conversation.needsReview) continue;

    const events = auditFor(conversation.id);
    const aiEvent = events.find((event) => event.type === "ai_suggested");
    const trigger: QaReviewTrigger = aiEvent ? "ai_draft" : "sensitive_reply";
    const submitted =
      [...events].reverse().find((event) => event.type === "ai_suggested" || event.type === "escalated") ??
      events[events.length - 1];

    details.push({
      conversationId: conversation.id,
      trigger,
      messageId: typeof aiEvent?.metadata?.messageId === "string" ? aiEvent.metadata.messageId : null,
      submittedAt: submitted?.createdAt ?? conversation.receivedAt,
      submittedById: "",
      submittedByName: submitted?.actor ?? "Unknown",
      status: "pending",
      checks: {},
      note: "",
      reviewerId: null,
      reviewerName: null,
      decidedAt: null,
    });
  }

  return details;
}

export interface SupervisorLedgers {
  /** Recorded escalation outcomes, keyed by conversation id. */
  readonly escalationOutcomes: Map<string, EscalationDetail>;
  /** Recorded QA decisions, keyed by conversation id. */
  readonly qaDecisions: Map<string, QaDecision>;
  /** In-progress QA reviews the store owns, keyed by conversation id. */
  readonly qaDrafts: Map<string, QaReviewDetail>;
}

export function buildSupervisorLedgers(): SupervisorLedgers {
  return {
    escalationOutcomes: new Map(),
    qaDecisions: new Map(),
    qaDrafts: new Map(),
  };
}

/**
 * Merge derived seeds with recorded outcomes.
 *
 * Recorded state wins wherever both exist, so a decision survives the conversation
 * being reopened and re-escalated.
 */
export function mergeEscalationLedger(
  seeds: readonly EscalationDetail[],
  outcomes: ReadonlyMap<string, EscalationDetail>,
): readonly EscalationDetail[] {
  const merged = new Map<string, EscalationDetail>();

  for (const seed of seeds) merged.set(seed.conversationId, seed);
  for (const [id, detail] of outcomes) {
    const seed = merged.get(id);
    merged.set(
      id,
      seed
        ? { ...seed, outcome: detail.outcome, resolvedAt: detail.resolvedAt, resolvedById: detail.resolvedById, resolvedByName: detail.resolvedByName, resolutionNote: detail.resolutionNote }
        : detail,
    );
  }

  return [...merged.values()];
}

export function mergeQaLedger(
  seeds: readonly QaReviewDetail[],
  drafts: ReadonlyMap<string, QaReviewDetail>,
  decisions: ReadonlyMap<string, QaDecision>,
): readonly QaReviewDetail[] {
  const merged = new Map<string, QaReviewDetail>();

  for (const seed of seeds) merged.set(seed.conversationId, seed);
  for (const [id, draft] of drafts) merged.set(id, { ...merged.get(id), ...draft });
  for (const [id, decision] of decisions) {
    const existing = merged.get(id);
    const checks: QaCheckResults = existing?.checks ?? {};
    merged.set(
      id,
      {
        conversationId: id,
        trigger: existing?.trigger ?? "sensitive_reply",
        messageId: existing?.messageId ?? null,
        submittedAt: existing?.submittedAt ?? decision.decidedAt,
        submittedById: existing?.submittedById ?? "",
        submittedByName: existing?.submittedByName ?? "Unknown",
        status: decision.status,
        checks: { ...checks, ...decision.checks },
        note: decision.note,
        reviewerId: decision.reviewerId,
        reviewerName: decision.reviewerName,
        decidedAt: decision.decidedAt,
      },
    );
  }

  return [...merged.values()];
}
