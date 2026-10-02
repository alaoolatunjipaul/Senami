import type { InboxAssignee } from "@/lib/domain/inbox";
import type { SupervisorQueueRow } from "@/lib/domain/supervisor";
import { DAY_MS, formatDate } from "@/lib/format";
import { formatDuration } from "@/lib/domain/sla";

/**
 * Team and agent performance (§26 Team Performance).
 *
 * Every figure here is measured from the same conversation records the rest of the
 * console reads. Nothing is seeded or estimated: a window with no closed
 * conversations reports zero rather than a plausible-looking number, because a
 * supervisor acting on an invented metric is worse off than one with no metric.
 * The trade-off is deliberate and is surfaced in the UI as a coverage note.
 */

export const PERFORMANCE_WINDOWS = ["today", "week", "month"] as const;
export type PerformanceWindow = (typeof PERFORMANCE_WINDOWS)[number];

export const PERFORMANCE_WINDOW_LABELS: Record<PerformanceWindow, string> = {
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
};

const WINDOW_MS: Record<PerformanceWindow, number> = {
  today: DAY_MS,
  week: 7 * DAY_MS,
  month: 30 * DAY_MS,
};

/**
 * Shown next to the figures so nobody mistakes this for a populated reporting
 * warehouse.
 */
export const PERFORMANCE_SOURCE_NOTE =
  "Measured from the conversations currently held in this workspace. Windows with no completed conversations report zero.";

export interface PerformanceDay {
  /** Local midnight of the day, as an ISO string. */
  readonly date: string;
  readonly label: string;
  readonly handled: number;
  readonly resolved: number;
  readonly slaBreached: number;
}

function startOfDay(at: Date): Date {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const lower = sorted[middle - 1] ?? 0;
  const upper = sorted[middle] ?? lower;
  return (lower + upper) / 2;
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

export interface AgentPerformance {
  readonly agentId: string;
  readonly agentName: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly window: PerformanceWindow;
  /** Conversations with activity in the window. */
  readonly handled: number;
  readonly resolved: number;
  readonly open: number;
  readonly escalated: number;
  readonly needsReview: number;
  readonly slaBreached: number;
  /** Minutes from receipt to first reply, median, across answered conversations. */
  readonly medianFirstResponseMinutes: number | null;
  readonly medianFirstResponseLabel: string;
  /** Share of answered conversations whose response SLA was met, 0-1. */
  readonly slaCompliance: number | null;
  readonly slaComplianceLabel: string;
  /** Mean age of handled conversations, in minutes. Null with nothing handled. */
  readonly meanAgeMinutes: number | null;
  readonly daily: readonly PerformanceDay[];
}

function buildDaily(window: PerformanceWindow, rows: readonly SupervisorQueueRow[], now: Date): readonly PerformanceDay[] {
  const days = window === "today" ? 1 : window === "week" ? 7 : 30;
  const today = startOfDay(now);

  // Oldest first, so a sparkline reads left to right in time order.
  return Array.from({ length: days }, (_, index) => {
    const start = new Date(today.getTime() - (days - 1 - index) * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS);
    const inDay = rows.filter((row) => row.lastMessageAt >= start && row.lastMessageAt < end);

    return {
      date: start.toISOString(),
      label: formatDate(start),
      handled: inDay.length,
      resolved: inDay.filter((row) => row.status === "resolved" || row.status === "closed").length,
      slaBreached: inDay.filter((row) => row.sla.state === "breached").length,
    };
  });
}

function toPerformance(input: {
  assignee: InboxAssignee;
  rows: readonly SupervisorQueueRow[];
  window: PerformanceWindow;
  now: Date;
}): AgentPerformance {
  const answered = input.rows.filter((row) => row.firstResponseMinutes !== null);
  const responseTimes = answered.map((row) => row.firstResponseMinutes as number);
  const medianFirstResponseMinutes = median(responseTimes);
  const metCount = answered.filter((row) => row.sla.state === "met").length;
  const slaCompliance = ratio(metCount, answered.length);

  return {
    agentId: input.assignee.id,
    agentName: input.assignee.name,
    teamId: input.assignee.teamId,
    teamName: input.assignee.teamName,
    window: input.window,
    handled: input.rows.length,
    resolved: input.rows.filter((row) => row.status === "resolved" || row.status === "closed").length,
    open: input.rows.filter((row) => row.status !== "resolved" && row.status !== "closed").length,
    escalated: input.rows.filter((row) => row.escalated).length,
    needsReview: input.rows.filter((row) => row.needsReview).length,
    slaBreached: input.rows.filter((row) => row.sla.state === "breached").length,
    medianFirstResponseMinutes,
    medianFirstResponseLabel:
      medianFirstResponseMinutes === null ? "\u2014" : formatDuration(medianFirstResponseMinutes * 60_000),
    slaCompliance,
    slaComplianceLabel: slaCompliance === null ? "\u2014" : `${Math.round(slaCompliance * 100)}%`,
    meanAgeMinutes:
      input.rows.length === 0
        ? null
        : Math.round(input.rows.reduce((total, row) => total + row.ageMinutes, 0) / input.rows.length),
    daily: buildDaily(input.window, input.rows, input.now),
  };
}

/**
 * One performance entry per assignee.
 *
 * The window bounds *activity*, not assignment: a conversation assigned today but
 * last touched a month ago does not count towards "today", which is what makes
 * the window mean what an operator expects.
 */
export function agentPerformances(
  assignees: readonly InboxAssignee[],
  rows: readonly SupervisorQueueRow[],
  window: PerformanceWindow,
  now: Date = new Date(),
): readonly AgentPerformance[] {
  const since = now.getTime() - WINDOW_MS[window];

  return assignees
    .map((assignee) =>
      toPerformance({
        assignee,
        rows: rows.filter(
          (row) =>
            row.assigneeId === assignee.id &&
            row.lastMessageAt.getTime() >= since &&
            row.lastMessageAt.getTime() <= now.getTime(),
        ),
        window,
        now,
      }),
    )
    .sort(
      (a, b) =>
        b.resolved - a.resolved ||
        b.handled - a.handled ||
        a.agentName.localeCompare(b.agentName),
    );
}

export interface TeamPerformance {
  readonly window: PerformanceWindow;
  readonly agents: number;
  readonly handled: number;
  readonly resolved: number;
  readonly open: number;
  readonly escalated: number;
  readonly slaBreached: number;
  readonly medianFirstResponseMinutes: number | null;
  readonly medianFirstResponseLabel: string;
  readonly slaCompliance: number | null;
  readonly slaComplianceLabel: string;
  readonly daily: readonly PerformanceDay[];
  /** Day-over-day change in handled volume, or null with fewer than two days. */
  readonly trendVsPreviousDay: number | null;
  readonly trendLabel: string;
}

export function teamPerformance(
  agents: readonly AgentPerformance[],
  window: PerformanceWindow,
): TeamPerformance {
  const handled = agents.reduce((total, agent) => total + agent.handled, 0);
  const resolved = agents.reduce((total, agent) => total + agent.resolved, 0);
  const answered = agents.flatMap((agent) => (agent.medianFirstResponseMinutes === null ? [] : [agent]));
  const medianFirstResponseMinutes = median(
    answered.map((agent) => agent.medianFirstResponseMinutes as number),
  );

  // The daily series is rebuilt from the per-agent series rather than summed
  // twice, so the totals and the chart always describe the same set.
  const totalsByDay = new Map<string, PerformanceDay>();
  for (const agent of agents) {
    for (const day of agent.daily) {
      const existing = totalsByDay.get(day.date);
      totalsByDay.set(
        day.date,
        existing
          ? {
              ...existing,
              handled: existing.handled + day.handled,
              resolved: existing.resolved + day.resolved,
              slaBreached: existing.slaBreached + day.slaBreached,
            }
          : { ...day },
      );
    }
  }
  const dailyTotals = [...totalsByDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  const last = dailyTotals[dailyTotals.length - 1];
  const previous = dailyTotals[dailyTotals.length - 2];
  const trend = last && previous && previous.handled > 0 ? (last.handled - previous.handled) / previous.handled : null;

  const slaCompliance = ratio(
    agents.reduce((total, agent) => total + (agent.slaCompliance ?? 0) * agent.handled, 0),
    agents.reduce((total, agent) => total + agent.handled, 0),
  );

  return {
    window,
    agents: agents.length,
    handled,
    resolved,
    open: agents.reduce((total, agent) => total + agent.open, 0),
    escalated: agents.reduce((total, agent) => total + agent.escalated, 0),
    slaBreached: agents.reduce((total, agent) => total + agent.slaBreached, 0),
    medianFirstResponseMinutes,
    medianFirstResponseLabel:
      medianFirstResponseMinutes === null ? "\u2014" : formatDuration(medianFirstResponseMinutes * 60_000),
    slaCompliance,
    slaComplianceLabel: slaCompliance === null ? "\u2014" : `${Math.round(slaCompliance * 100)}%`,
    daily: dailyTotals,
    trendVsPreviousDay: trend,
    trendLabel:
      trend === null
        ? "Not enough history"
        : trend === 0
          ? "Level with yesterday"
          : `${trend > 0 ? "Up" : "Down"} ${Math.abs(Math.round(trend * 100))}% vs yesterday`,
  };
}

/* -------------------------------------------------------------------------
 * Serialisation (Date -> ISO) across the API boundary
 * ---------------------------------------------------------------------- */

export interface TeamPerformanceDto extends TeamPerformance {
  readonly daily: readonly PerformanceDay[];
}

export interface PerformanceReportResponse {
  readonly team: TeamPerformanceDto;
  readonly agents: readonly AgentPerformance[];
  readonly note: string;
}
