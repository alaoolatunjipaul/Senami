import type { AgentPresence } from "@/lib/domain/supervisor";
import { WORKING_PRESENCE } from "@/lib/domain/supervisor";
import { SLA_STATE_TONE, type SlaState } from "@/lib/domain/sla";
import { formatDuration } from "@/lib/domain/sla";
import type { Tone } from "@/lib/domain/taxonomy";
import type { SupervisorQueueRow } from "@/lib/domain/supervisor";

/**
 * Supervisor dashboard figures.
 *
 * Every number here is counted from the same queue rows the table shows, so a
 * figure can never disagree with the list an operator is looking at when they
 * click the tile. Nothing is persisted: change a conversation and the tile moves
 * with it (§38).
 */

export const SUPERVISOR_KPI_IDS = [
  "active",
  "unassigned",
  "at_risk",
  "breached",
  "escalated",
  "needs_review",
  "agents_online",
  "first_response",
] as const;

export type SupervisorKpiId = (typeof SUPERVISOR_KPI_IDS)[number];

export interface SupervisorKpi {
  readonly id: SupervisorKpiId;
  readonly label: string;
  /** Raw figure, or null for a measure with no meaningful zero-point. */
  readonly value: number | null;
  /** Pre-formatted for display so the UI never re-derives a duration. */
  readonly display: string;
  readonly tone: Tone;
  /** One line of context, e.g. "3 need an owner". */
  readonly hint: string;
  /** Deep link into the console, pre-filtered, so the tile is actionable. */
  readonly href: string;
}

export interface SupervisorPresenceSummary {
  readonly agentId: string;
  readonly presence: AgentPresence;
}

export interface SupervisorKpiSnapshot {
  readonly total: number;
  readonly active: number;
  readonly unassigned: number;
  readonly assigned: number;
  readonly atRisk: number;
  readonly breached: number;
  readonly escalated: number;
  readonly needsReview: number;
  readonly agentsOnline: number;
  readonly agentsTotal: number;
  /** Median minutes to first agent response across answered conversations. */
  readonly medianFirstResponseMinutes: number | null;
  /** Share of conversations whose response SLA was met, 0-1. */
  readonly slaCompliance: number | null;
}

function countBy<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.reduce((total, item) => (predicate(item) ? total + 1 : total), 0);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  // Even sample counts average the two central values so the figure is not
  // biased towards whichever agent happens to sit at the midpoint.
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const lower = sorted[middle - 1] ?? 0;
  const upper = sorted[middle] ?? lower;
  return (lower + upper) / 2;
}

/**
 * Count the operational headline figures.
 *
 * "Active" means an open clock: not resolved and not closed. A conversation
 * awaiting the customer is still active work, because the SLA clock keeps
 * running on the next reply (§16).
 */
export function supervisorSnapshot(
  rows: readonly SupervisorQueueRow[],
  presence: readonly SupervisorPresenceSummary[] = [],
): SupervisorKpiSnapshot {
  const activeRows = rows.filter(
    (row) => row.status !== "resolved" && row.status !== "closed",
  );
  const answered = rows.filter((row) => row.firstResponseMinutes !== null);
  const responseTimes = answered.map((row) => row.firstResponseMinutes as number);
  const metCount = countBy(answered, (row) => row.sla.state === "met");

  return {
    total: rows.length,
    active: activeRows.length,
    unassigned: countBy(activeRows, (row) => row.assigneeId === null),
    assigned: countBy(activeRows, (row) => row.assigneeId !== null),
    atRisk: countBy(activeRows, (row) => row.sla.state === "warning"),
    breached: countBy(activeRows, (row) => row.sla.state === "breached"),
    escalated: countBy(activeRows, (row) => row.escalated),
    needsReview: countBy(activeRows, (row) => row.needsReview),
    agentsOnline: countBy(
      presence,
      (entry) => WORKING_PRESENCE.includes(entry.presence),
    ),
    agentsTotal: presence.length,
    medianFirstResponseMinutes: median(responseTimes),
    slaCompliance: answered.length === 0 ? null : metCount / answered.length,
  };
}

function percentage(value: number | null): string {
  return value === null ? "\u2014" : `${Math.round(value * 100)}%`;
}

/**
 * The tile set. `href` values reuse the same filter vocabulary the queue
 * understands, so a tile click and a manual filter produce the same table.
 */
export function supervisorKpis(
  rows: readonly SupervisorQueueRow[],
  presence: readonly SupervisorPresenceSummary[] = [],
): readonly SupervisorKpi[] {
  const snapshot = supervisorSnapshot(rows, presence);

  return [
    {
      id: "active",
      label: "Active conversations",
      value: snapshot.active,
      display: String(snapshot.active),
      tone: "info",
      hint: `${snapshot.total} in total`,
      href: "/supervisor/queue",
    },
    {
      id: "unassigned",
      label: "Unassigned",
      value: snapshot.unassigned,
      display: String(snapshot.unassigned),
      tone: snapshot.unassigned > 0 ? "warning" : "success",
      hint: snapshot.unassigned === 0 ? "Every active conversation has an owner" : "Need an owner",
      href: "/supervisor/queue?assignment=unassigned",
    },
    {
      id: "at_risk",
      label: "At risk",
      value: snapshot.atRisk,
      display: String(snapshot.atRisk),
      tone: SLA_STATE_TONE.warning,
      hint: "Inside the warning window",
      href: "/supervisor/queue?sla=warning",
    },
    {
      id: "breached",
      label: "SLA breached",
      value: snapshot.breached,
      display: String(snapshot.breached),
      tone: SLA_STATE_TONE.breached,
      hint: snapshot.breached === 0 ? "Nothing overdue" : "Past the first-response deadline",
      href: "/supervisor/queue?sla=breached",
    },
    {
      id: "escalated",
      label: "Escalated",
      value: snapshot.escalated,
      display: String(snapshot.escalated),
      tone: "critical",
      hint: "Waiting on a supervisor decision",
      href: "/supervisor/escalations",
    },
    {
      id: "needs_review",
      label: "Needs review",
      value: snapshot.needsReview,
      display: String(snapshot.needsReview),
      tone: "primary",
      hint: "AI drafts and sensitive replies",
      href: "/supervisor/qa",
    },
    {
      id: "agents_online",
      label: "Agents online",
      value: snapshot.agentsTotal === 0 ? null : snapshot.agentsOnline,
      display: snapshot.agentsTotal === 0 ? "\u2014" : `${snapshot.agentsOnline}/${snapshot.agentsTotal}`,
      tone: snapshot.agentsOnline === 0 ? "critical" : "success",
      hint: snapshot.agentsOnline === 0 ? "Nobody on shift" : "Available for work",
      href: "/supervisor/team",
    },
    {
      id: "first_response",
      label: "Median first response",
      value: snapshot.medianFirstResponseMinutes,
      display:
        snapshot.medianFirstResponseMinutes === null
          ? "\u2014"
          : formatDuration(snapshot.medianFirstResponseMinutes * 60_000),
      tone: "neutral",
      hint: `${percentage(snapshot.slaCompliance)} of answers met the SLA`,
      href: "/supervisor/sla",
    },
  ];
}

/** Bucket rows by SLA state, for the SLA monitoring page and its filter chips. */
export function slaStateCounts(rows: readonly SupervisorQueueRow[]): Record<SlaState, number> {
  const counts: Record<SlaState, number> = { safe: 0, warning: 0, breached: 0, met: 0, paused: 0 };
  for (const row of rows) counts[row.sla.state] += 1;
  return counts;
}
