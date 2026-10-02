import {
  ESCALATION_REASON_LABELS,
  ESCALATION_REASONS,
  type EscalationReason,
} from "@/lib/domain/conversation";
import type { SupervisorQueueRow } from "@/lib/domain/supervisor";
import { SLA_STATE_TONE, formatDuration } from "@/lib/domain/sla";
import type { Tone } from "@/lib/domain/taxonomy";
import { HOUR_MS } from "@/lib/format";

/**
 * Supervisor escalation board (§26).
 *
 * The reason vocabulary already exists in `lib/domain/conversation.ts` and is
 * re-exported unchanged here: an escalation must read the same whether it was
 * raised from the conversation workspace or from the supervisor console.
 *
 * A conversation is escalated when its status is `escalated`, but the status
 * alone does not tell a supervisor what is needed. The reason and the note live
 * in an escalation ledger owned by the server store; this module merges that
 * ledger with the live conversation rows so an escalation can never drift out of
 * sync with the conversation it refers to.
 */

export { ESCALATION_REASON_LABELS, ESCALATION_REASONS, type EscalationReason };

export const ESCALATION_REASON_OPTIONS = ESCALATION_REASONS.map((reason) => ({
  value: reason,
  label: ESCALATION_REASON_LABELS[reason],
}));

/**
 * Reasons that need a decision now rather than a scheduled look. A suspected
 * fraud case is treated as urgent regardless of elapsed time.
 */
const URGENT_REASONS: readonly EscalationReason[] = ["fraud_risk", "sla_breach", "complex_case"];

/** Ledger entry: what was recorded at the moment of escalation. */
export interface EscalationDetail {
  readonly conversationId: string;
  readonly reason: EscalationReason;
  /** Free-text context captured at escalation time. */
  readonly note: string;
  readonly escalatedById: string;
  readonly escalatedByName: string;
  readonly escalatedAt: Date;
  /** Outcome recorded when the escalation is dealt with, if it has been. */
  readonly outcome: EscalationOutcome | null;
  readonly resolvedAt: Date | null;
  readonly resolvedById: string | null;
  readonly resolvedByName: string | null;
  readonly resolutionNote: string;
}

export const ESCALATION_OUTCOMES = ["resolved", "reassigned", "dismissed"] as const;
export type EscalationOutcome = (typeof ESCALATION_OUTCOMES)[number];

export const ESCALATION_OUTCOME_LABELS: Record<EscalationOutcome, string> = {
  resolved: "Resolved",
  reassigned: "Reassigned",
  dismissed: "Dismissed",
};

export const ESCALATION_OUTCOME_TONE: Record<EscalationOutcome, Tone> = {
  resolved: "success",
  reassigned: "info",
  dismissed: "neutral",
};

export const ESCALATION_OUTCOME_OPTIONS = ESCALATION_OUTCOMES.map((outcome) => ({
  value: outcome,
  label: ESCALATION_OUTCOME_LABELS[outcome],
}));

export interface EscalationUrgency {
  readonly level: "urgent" | "due_soon" | "normal";
  readonly label: string;
  readonly tone: Tone;
}

/**
 * How long an escalation has waited, bucketed rather than shown as a raw
 * timestamp. The thresholds match the cadence operators expect: under 15 minutes
 * is fresh, up to an hour is due soon, beyond that it is stale.
 */
export function escalationUrgencyOf(
  escalatedAt: Date,
  reason: EscalationReason,
  now: Date = new Date(),
): EscalationUrgency {
  const ageMs = Math.max(0, now.getTime() - escalatedAt.getTime());

  if (URGENT_REASONS.includes(reason) || ageMs >= HOUR_MS) {
    return {
      level: "urgent",
      label: ageMs >= HOUR_MS ? `Waiting ${formatDuration(ageMs)}` : ESCALATION_REASON_LABELS[reason],
      tone: "critical",
    };
  }
  if (ageMs >= 15 * 60_000) {
    return { level: "due_soon", label: `Waiting ${formatDuration(ageMs)}`, tone: "warning" };
  }
  return { level: "normal", label: "Just raised", tone: "neutral" };
}

export interface EscalationRow {
  readonly conversationId: string;
  readonly reason: EscalationReason;
  readonly reasonLabel: string;
  readonly note: string;
  readonly escalatedById: string;
  readonly escalatedByName: string;
  readonly escalatedAt: Date;
  readonly waitingMs: number;
  readonly urgency: EscalationUrgency;
  /** The underlying conversation projection, reused by the row component. */
  readonly conversation: SupervisorQueueRow;
  readonly outcome: EscalationOutcome | null;
  readonly outcomeLabel: string | null;
  readonly resolvedAt: Date | null;
  readonly resolvedByName: string | null;
  readonly resolutionNote: string;
  readonly isOpen: boolean;
  readonly href: string;
}

/**
 * Merge the escalation ledger with live conversation rows.
 *
 * The conversation rows are the authority: an entry in the ledger whose
 * conversation is no longer escalated is reported as closed, so resolving a
 * conversation can never leave a phantom escalation on the board.
 */
export function escalationRows(
  rows: readonly SupervisorQueueRow[],
  ledger: readonly EscalationDetail[],
  now: Date = new Date(),
): readonly EscalationRow[] {
  const byConversation = new Map(ledger.map((entry) => [entry.conversationId, entry]));

  return rows
    .filter((row) => row.escalated || byConversation.has(row.id))
    .map((row) => {
      const detail = byConversation.get(row.id);
      const escalatedAt = detail?.escalatedAt ?? row.statusChangedAt;
      const reason = detail?.reason ?? "other";
      const waitingMs = Math.max(0, now.getTime() - escalatedAt.getTime());

      return {
        conversationId: row.id,
        reason,
        reasonLabel: ESCALATION_REASON_LABELS[reason],
        note: detail?.note ?? "",
        escalatedById: detail?.escalatedById ?? "",
        escalatedByName: detail?.escalatedByName ?? "Unknown",
        escalatedAt,
        waitingMs,
        urgency: escalationUrgencyOf(escalatedAt, reason, now),
        conversation: row,
        outcome: detail?.outcome ?? null,
        outcomeLabel: detail?.outcome ? ESCALATION_OUTCOME_LABELS[detail.outcome] : null,
        resolvedAt: detail?.resolvedAt ?? null,
        resolvedByName: detail?.resolvedByName ?? null,
        resolutionNote: detail?.resolutionNote ?? "",
        isOpen: row.escalated,
        href: `/conversations/${row.id}`,
      };
    })
    .sort((a, b) => a.waitingMs - b.waitingMs || a.conversationId.localeCompare(b.conversationId));
}

export interface EscalationSummary {
  readonly total: number;
  readonly open: number;
  readonly urgent: number;
  readonly unowned: number;
  readonly byReason: ReadonlyArray<{
    readonly reason: EscalationReason;
    readonly label: string;
    readonly count: number;
  }>;
  readonly oldestWaitingMs: number | null;
}

/** Headline counts for the escalation board and its filter chips. */
export function escalationSummary(rows: readonly EscalationRow[]): EscalationSummary {
  const open = rows.filter((row) => row.isOpen);
  const waiting = open.map((row) => row.waitingMs);

  return {
    total: rows.length,
    open: open.length,
    urgent: open.filter((row) => row.urgency.level === "urgent").length,
    unowned: open.filter((row) => row.conversation.assigneeId === null).length,
    byReason: ESCALATION_REASONS.map((reason) => ({
      reason,
      label: ESCALATION_REASON_LABELS[reason],
      count: open.filter((row) => row.reason === reason).length,
    })),
    oldestWaitingMs: waiting.length === 0 ? null : Math.max(...waiting),
  };
}

export const ESCALATION_FILTERS = ["open", "urgent", "unowned", "all"] as const;
export type EscalationFilter = (typeof ESCALATION_FILTERS)[number];

export const ESCALATION_FILTER_LABELS: Record<EscalationFilter, string> = {
  open: "Open",
  urgent: "Urgent",
  unowned: "No owner",
  all: "All",
};

export function matchesEscalationFilter(row: EscalationRow, filter: EscalationFilter): boolean {
  switch (filter) {
    case "open":
      return row.isOpen;
    case "urgent":
      return row.isOpen && row.urgency.level === "urgent";
    case "unowned":
      return row.isOpen && row.conversation.assigneeId === null;
    case "all":
      return true;
  }
}

/** The SLA tone of the conversation behind an escalation, for the row badge. */
export function escalationSlaTone(row: EscalationRow): Tone {
  return SLA_STATE_TONE[row.conversation.sla.state];
}

/* -------------------------------------------------------------------------
 * Serialisation (Date -> ISO) across the API boundary
 * ---------------------------------------------------------------------- */

export interface EscalationRowDto extends Omit<EscalationRow, "escalatedAt" | "waitingMs" | "conversation"> {
  readonly escalatedAt: string;
  readonly waitingMs: number;
  readonly urgency: EscalationUrgency;
  readonly conversation: SupervisorQueueRow;
}

export function toEscalationRowDto(row: EscalationRow): EscalationRowDto {
  return {
    ...row,
    escalatedAt: row.escalatedAt.toISOString(),
  };
}
