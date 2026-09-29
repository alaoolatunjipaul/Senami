import { DEFAULT_SLA_MINUTES } from "@/lib/config";
import type { Priority } from "@/lib/domain/taxonomy";

/**
 * SLA calculation.
 *
 * Every SLA value in Senami is derived from real timestamps and a policy - no
 * countdown in the interface is ever hard-coded (spec section 24). All
 * functions here are pure so they can be exhaustively unit tested without a
 * clock or a database.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

export interface SlaPolicy {
  /** Minutes allowed for the first response, derived from priority. */
  readonly firstResponseMinutes: number;
  /** Minutes before the deadline at which the SLA is considered at risk. */
  readonly warningMinutes: number;
}

export type SlaState = "safe" | "warning" | "breached" | "met" | "paused";

export interface SlaEvaluation {
  /** Absolute deadline for the first response. */
  readonly deadline: Date;
  /** Absolute time at which the conversation becomes "at risk". */
  readonly warningAt: Date;
  /** Milliseconds until the deadline. Negative once breached. */
  readonly remainingMs: number;
  /** Milliseconds past the deadline. Always 0 when not breached. */
  readonly overdueMs: number;
  readonly state: SlaState;
  /** Human-readable countdown, e.g. "2h 15m remaining". */
  readonly label: string;
  /** When the first response was actually sent, if any. */
  readonly firstRespondedAt: Date | null;
}

const DEFAULT_WARNING_MINUTES = 15;

/** Resolve the SLA policy for a conversation priority. */
export function getSlaPolicy(
  priority: Priority,
  warningMinutes = DEFAULT_WARNING_MINUTES,
): SlaPolicy {
  return {
    firstResponseMinutes: DEFAULT_SLA_MINUTES[priority],
    warningMinutes,
  };
}

/**
 * Evaluate an SLA against a point in time.
 *
 * The state machine is deliberately total: it always returns a value, because
 * an operator must never see a blank SLA indicator.
 */
export function evaluateSla(input: {
  policy: SlaPolicy;
  startedAt: Date;
  firstRespondedAt?: Date | null;
  paused?: boolean;
  now?: Date;
}): SlaEvaluation {
  const { policy, startedAt, firstRespondedAt = null, paused = false } = input;
  const now = input.now ?? new Date();

  const deadline = new Date(startedAt.getTime() + policy.firstResponseMinutes * MINUTE_MS);
  const warningAt = new Date(deadline.getTime() - policy.warningMinutes * MINUTE_MS);

  const remainingMs = deadline.getTime() - now.getTime();
  const overdueMs = remainingMs < 0 ? Math.abs(remainingMs) : 0;

  let state: SlaState;
  // A recorded first response is the strongest fact: a conversation that has
  // been answered has met its SLA, regardless of a stale pause flag.
  if (firstRespondedAt) {
    state = "met";
  } else if (paused) {
    state = "paused";
  } else if (remainingMs <= 0) {
    state = "breached";
  } else if (now.getTime() >= warningAt.getTime()) {
    state = "warning";
  } else {
    state = "safe";
  }

  return {
    deadline,
    warningAt,
    remainingMs,
    overdueMs,
    state,
    label: formatSlaLabel(state, remainingMs, overdueMs, firstRespondedAt, startedAt, now),
    firstRespondedAt,
  };
}

/**
 * Format a duration the way an operator reads it: coarse, short and
 * unambiguous. Sub-minute precision is noise in a queue, so it collapses to
 * "under 1m".
 */
export function formatDuration(ms: number): string {
  const absoluteMs = Math.abs(ms);

  if (absoluteMs < MINUTE_MS) {
    return "under 1m";
  }

  // Round up so a countdown never displays "0m" while time still remains.
  const totalMinutes = Math.ceil(absoluteMs / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatSlaLabel(
  state: SlaState,
  remainingMs: number,
  overdueMs: number,
  firstRespondedAt: Date | null,
  startedAt: Date,
  now: Date,
): string {
  switch (state) {
    case "breached":
      return `${formatDuration(overdueMs)} over SLA`;
    case "warning":
      return `${formatDuration(remainingMs)} remaining`;
    case "safe":
      return `${formatDuration(remainingMs)} remaining`;
    case "paused":
      return "Paused";
    case "met": {
      const responded = firstRespondedAt ?? now;
      const taken = responded.getTime() - startedAt.getTime();
      return `Met in ${formatDuration(taken)}`;
    }
  }
}

/** Accessible tone for an SLA state, used by the indicator component. */
export const SLA_STATE_TONE: Record<SlaState, "success" | "warning" | "critical" | "neutral"> = {
  safe: "success",
  warning: "warning",
  breached: "critical",
  met: "success",
  paused: "neutral",
};

/** Screen-reader description, so state is never conveyed by colour alone. */
export const SLA_STATE_LABEL: Record<SlaState, string> = {
  safe: "On track",
  warning: "At risk",
  breached: "Breached",
  met: "Met",
  paused: "Paused",
};
