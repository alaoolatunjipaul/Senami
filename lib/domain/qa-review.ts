import type { SupervisorQueueRow } from "@/lib/domain/supervisor";
import type { Tone } from "@/lib/domain/taxonomy";

/**
 * QA review (§26 QA Review, and §18 reply quality).
 *
 * A QA item is a conversation awaiting a quality check before its outbound
 * reply goes live: AI-generated drafts, replies flagged sensitive, and anything a
 * supervisor explicitly submits for review. The checklist lives here so the review
 * dialog and the API validate against exactly the same criteria.
 */

export const QA_REVIEW_STATUSES = ["pending", "in_review", "approved", "changes_requested"] as const;
export type QaReviewStatus = (typeof QA_REVIEW_STATUSES)[number];

export const QA_REVIEW_STATUS_LABELS: Record<QaReviewStatus, string> = {
  pending: "Awaiting review",
  in_review: "In review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const QA_REVIEW_STATUS_TONE: Record<QaReviewStatus, Tone> = {
  pending: "warning",
  in_review: "info",
  approved: "success",
  changes_requested: "critical",
};

/* -------------------------------------------------------------------------
 * Checklist
 * ---------------------------------------------------------------------- */

export const QA_CHECK_IDS = ["accuracy", "tone", "privacy", "compliance"] as const;
export type QaCheckId = (typeof QA_CHECK_IDS)[number];

export interface QaCheckMeta {
  readonly label: string;
  readonly description: string;
  /**
   * Required checks must be answered before a review can be decided. This is
   * enforced in `validateQaDecision` so the UI and the API cannot disagree.
   */
  readonly required: boolean;
}

export const QA_CHECK_META: Record<QaCheckId, QaCheckMeta> = {
  accuracy: {
    label: "Facts and accuracy",
    description: "Every figure, date and policy reference matches the conversation record.",
    required: true,
  },
  tone: {
    label: "Tone and clarity",
    description: "Appropriate for the channel and the customer's sentiment. No jargon or blame.",
    required: true,
  },
  privacy: {
    label: "Privacy",
    description: "No account numbers, addresses or personal data the customer did not supply.",
    required: true,
  },
  compliance: {
    label: "Compliance",
    description: "Required disclaimers present, and nothing that promises an outcome.",
    required: false,
  },
};

export const QA_CHECKS: ReadonlyArray<{ readonly id: QaCheckId; readonly meta: QaCheckMeta }> = QA_CHECK_IDS.map(
  (id) => ({ id, meta: QA_CHECK_META[id] }),
);

export const QA_CHECK_OUTCOMES = ["pass", "fail", "not_applicable"] as const;
export type QaCheckOutcome = (typeof QA_CHECK_OUTCOMES)[number];

export const QA_CHECK_OUTCOME_LABELS: Record<QaCheckOutcome, string> = {
  pass: "Pass",
  fail: "Needs work",
  not_applicable: "Not applicable",
};

export const QA_CHECK_OUTCOME_TONE: Record<QaCheckOutcome, Tone> = {
  pass: "success",
  fail: "critical",
  not_applicable: "neutral",
};

export type QaCheckResults = Partial<Record<QaCheckId, QaCheckOutcome>>;

export const QA_REVIEW_NOTE_MAX = 1000;

/** How a review request entered the queue, used for reporting and filtering. */
export const QA_REVIEW_TRIGGERS = ["ai_draft", "sensitive_reply", "manual"] as const;
export type QaReviewTrigger = (typeof QA_REVIEW_TRIGGERS)[number];

export const QA_REVIEW_TRIGGER_LABELS: Record<QaReviewTrigger, string> = {
  ai_draft: "AI draft",
  sensitive_reply: "Sensitive reply",
  manual: "Submitted by agent",
};

export interface QaReviewDetail {
  readonly conversationId: string;
  readonly trigger: QaReviewTrigger;
  /** Message the reviewer is checking, when the item is about a specific reply. */
  readonly messageId: string | null;
  readonly submittedAt: Date;
  readonly submittedById: string;
  readonly submittedByName: string;
  readonly status: QaReviewStatus;
  readonly checks: QaCheckResults;
  readonly note: string;
  readonly reviewerId: string | null;
  readonly reviewerName: string | null;
  readonly decidedAt: Date | null;
}

/** Ledger record created when a reviewer approves or asks for changes. */
export interface QaDecision {
  readonly conversationId: string;
  readonly status: Extract<QaReviewStatus, "approved" | "changes_requested">;
  readonly checks: QaCheckResults;
  readonly note: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly decidedAt: Date;
}

export interface QaValidation {
  readonly valid: boolean;
  /** Field-keyed messages so the dialog can anchor each error to its control. */
  readonly errors: Readonly<Record<string, string>>;
}

const REQUIRED_UNANSWERED: string = "Answer this check before deciding.";

/**
 * Gate a review decision. Both the client dialog and the API call this, so a
 * request cannot be crafted that skips a required check or approves with a
 * failing criterion still marked as needing work.
 */
export function validateQaDecision(checks: QaCheckResults, status: QaReviewStatus, note: string): QaValidation {
  const errors: Record<string, string> = {};

  for (const { id, meta } of QA_CHECKS) {
    if (meta.required && checks[id] === undefined) {
      errors[id] = REQUIRED_UNANSWERED;
    }
    if (checks[id] === "fail" && status === "approved") {
      errors[id] = "A failing check cannot be approved.";
    }
  }

  if (note.length > QA_REVIEW_NOTE_MAX) {
    errors.note = `Keep the note under ${QA_REVIEW_NOTE_MAX} characters.`;
  }

  // Asking for changes without saying what is wrong leaves the agent nothing to
  // act on, so a note is mandatory in that direction.
  if (status === "changes_requested" && note.trim().length === 0) {
    errors.note = "Explain what needs to change before requesting changes.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Required checks still unanswered, for a progress hint in the dialog. */
export function unansweredRequiredChecks(checks: QaCheckResults): readonly QaCheckId[] {
  return QA_CHECKS.filter(({ id, meta }) => meta.required && checks[id] === undefined).map(({ id }) => id);
}

export interface QaReviewRow {
  readonly conversationId: string;
  readonly status: QaReviewStatus;
  readonly statusLabel: string;
  readonly statusTone: Tone;
  readonly trigger: QaReviewTrigger;
  readonly triggerLabel: string;
  readonly messageId: string | null;
  readonly submittedAt: Date;
  readonly submittedByName: string;
  readonly submittedById: string;
  readonly checks: QaCheckResults;
  readonly checksAnswered: number;
  readonly checksTotal: number;
  readonly failingChecks: readonly QaCheckId[];
  readonly note: string;
  readonly reviewerName: string | null;
  readonly decidedAt: Date | null;
  /** The conversation under review, reused by the row component. */
  readonly conversation: SupervisorQueueRow;
  readonly href: string;
}

/**
 * Merge the QA ledger with live conversation rows.
 *
 * Conversation rows are the authority: a ledger entry whose conversation is no
 * longer flagged for review is reported as decided, so clearing the review flag
 * can never leave a stuck "awaiting review" row behind.
 */
export function qaReviewRows(
  rows: readonly SupervisorQueueRow[],
  ledger: readonly QaReviewDetail[],
  decisions: readonly QaDecision[] = [],
): readonly QaReviewRow[] {
  const byConversation = new Map(ledger.map((entry) => [entry.conversationId, entry]));
  const decisionByConversation = new Map(decisions.map((entry) => [entry.conversationId, entry]));
  const ids = new Set([...rows.filter((row) => row.needsReview).map((row) => row.id), ...byConversation.keys()]);

  return [...ids]
    .map((id) => {
      const row = rows.find((candidate) => candidate.id === id);
      const detail = byConversation.get(id);
      const decision = decisionByConversation.get(id);

      // With no ledger entry there is still a real review to do: the conversation
      // itself is flagged `needsReview`.
      const status: QaReviewStatus = decision?.status ?? detail?.status ?? "pending";
      const checks = decision?.checks ?? detail?.checks ?? {};
      const failingChecks = QA_CHECKS.map(({ id: checkId }) => checkId).filter(
        (checkId) => checks[checkId] === "fail",
      );
      const submittedAt = decision?.decidedAt ?? detail?.submittedAt ?? row?.lastMessageAt ?? new Date(0);

      return {
        conversationId: id,
        status,
        statusLabel: QA_REVIEW_STATUS_LABELS[status],
        statusTone: QA_REVIEW_STATUS_TONE[status],
        trigger: detail?.trigger ?? "sensitive_reply",
        triggerLabel: QA_REVIEW_TRIGGER_LABELS[detail?.trigger ?? "sensitive_reply"],
        messageId: detail?.messageId ?? null,
        submittedAt,
        submittedByName: detail?.submittedByName ?? "Unknown",
        submittedById: detail?.submittedById ?? "",
        checks,
        checksAnswered: QA_CHECKS.filter(({ id: checkId }) => checks[checkId] !== undefined).length,
        checksTotal: QA_CHECKS.length,
        failingChecks,
        note: decision?.note ?? detail?.note ?? "",
        reviewerName: decision?.reviewerName ?? detail?.reviewerName ?? null,
        decidedAt: decision?.decidedAt ?? detail?.decidedAt ?? null,
        conversation: row as SupervisorQueueRow,
        href: `/conversations/${id}`,
      } satisfies QaReviewRow;
    })
    .sort((a, b) => {
      // Outstanding work first, oldest submission first within a status.
      const rank = (status: QaReviewStatus): number =>
        status === "pending" ? 0 : status === "in_review" ? 1 : status === "changes_requested" ? 2 : 3;
      return (
        rank(a.status) - rank(b.status) ||
        a.submittedAt.getTime() - b.submittedAt.getTime() ||
        a.conversationId.localeCompare(b.conversationId)
      );
    });
}

export const QA_FILTERS = ["pending", "in_review", "changes_requested", "approved", "all"] as const;
export type QaFilter = (typeof QA_FILTERS)[number];

export const QA_FILTER_LABELS: Record<QaFilter, string> = {
  pending: "Awaiting review",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  all: "All",
};

export function matchesQaFilter(row: QaReviewRow, filter: QaFilter): boolean {
  return filter === "all" ? true : row.status === filter;
}

export interface QaSummary {
  readonly total: number;
  readonly pending: number;
  readonly inReview: number;
  readonly changesRequested: number;
  readonly approved: number;
  /** Share of decided reviews that approved, 0-1. Null when nothing decided yet. */
  readonly approvalRate: number | null;
  /** Checks most often failed, most frequent first. */
  readonly weakestChecks: ReadonlyArray<{ readonly id: QaCheckId; readonly label: string; readonly failures: number }>;
}

export function qaSummary(rows: readonly QaReviewRow[]): QaSummary {
  const decided = rows.filter((row) => row.status === "approved" || row.status === "changes_requested");
  const failureCounts = new Map<QaCheckId, number>();

  for (const row of decided) {
    for (const checkId of row.failingChecks) {
      failureCounts.set(checkId, (failureCounts.get(checkId) ?? 0) + 1);
    }
  }

  return {
    total: rows.length,
    pending: rows.filter((row) => row.status === "pending").length,
    inReview: rows.filter((row) => row.status === "in_review").length,
    changesRequested: rows.filter((row) => row.status === "changes_requested").length,
    approved: rows.filter((row) => row.status === "approved").length,
    approvalRate: decided.length === 0 ? null : decided.filter((row) => row.status === "approved").length / decided.length,
    weakestChecks: QA_CHECKS.map(({ id, meta }) => ({ id, label: meta.label, failures: failureCounts.get(id) ?? 0 }))
      .filter((entry) => entry.failures > 0)
      .sort((a, b) => b.failures - a.failures || a.label.localeCompare(b.label)),
  };
}

/* -------------------------------------------------------------------------
 * Serialisation (Date -> ISO) across the API boundary
 * ---------------------------------------------------------------------- */

export interface QaReviewRowDto extends Omit<QaReviewRow, "submittedAt" | "decidedAt" | "conversation"> {
  readonly submittedAt: string;
  readonly decidedAt: string | null;
  readonly conversation: SupervisorQueueRow;
}

export function toQaReviewRowDto(row: QaReviewRow): QaReviewRowDto {
  return {
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}
