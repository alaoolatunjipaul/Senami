import { CHANNEL_LABELS } from "@/lib/config";
import type { ChannelId } from "@/lib/config";
import type { Tone } from "@/lib/domain/taxonomy";
import { formatDuration, MINUTE_MS } from "@/lib/domain/sla";
import type { UserProfile } from "@/lib/domain/user";

/**
 * Agent dashboard domain (§10).
 *
 * The dashboard is an aggregation, not a copy: every count is derived from the
 * same conversation records the inbox shows, so a tile can never disagree with
 * the list behind it. The response metrics are equally derived - first-response
 * times come from real `receivedAt`/`respondedAt` pairs, and the historical
 * daily trend is generated from a fixed seed so the demo is stable across boots.
 */

export const AGENT_TILE_IDS = [
  "assigned",
  "unassigned",
  "needs_review",
  "sla_at_risk",
  "sla_breached",
  "awaiting_customer",
  "escalated",
] as const;

export type AgentTileId = (typeof AGENT_TILE_IDS)[number];

export interface AgentTile {
  readonly id: AgentTileId;
  readonly label: string;
  readonly description: string;
  readonly count: number;
  readonly tone: Tone;
  /** Deep link into the inbox, pre-filtered to exactly this bucket. */
  readonly href: string;
}

export interface AgentMetric {
  readonly id: string;
  readonly label: string;
  /** Pre-formatted so the UI never invents a unit. */
  readonly value: string;
  readonly hint: string;
  readonly tone: Tone;
  /** Bar length for the metric strip, 0-1. */
  readonly ratio: number;
}

export type AgentActivityKind =
  | "replied"
  | "noted"
  | "assigned"
  | "escalated"
  | "resolved"
  | "ai_assisted";

export interface AgentActivity {
  readonly id: string;
  readonly kind: AgentActivityKind;
  readonly conversationId: string;
  readonly conversationLabel: string;
  readonly customerName: string;
  readonly channel: ChannelId;
  readonly summary: string;
  readonly at: Date;
  readonly tone: Tone;
}

export interface AgentTrendPoint {
  /** ISO date (yyyy-mm-dd) of the day the point covers. */
  readonly date: string;
  readonly label: string;
  readonly firstResponseMinutes: number;
  readonly conversationsTouched: number;
  readonly resolved: number;
}

export interface AgentDashboard {
  readonly agent: Pick<UserProfile, "id" | "name" | "role">;
  readonly tiles: readonly AgentTile[];
  readonly metrics: readonly AgentMetric[];
  readonly today: {
    readonly repliesSent: number;
    readonly notesAdded: number;
    readonly conversationsResolved: number;
    readonly escalationsRaised: number;
    readonly aiSuggestionsUsed: number;
    readonly firstResponseMinutes: number;
    readonly slaMetCount: number;
    readonly slaBreachedCount: number;
  };
  readonly activity: readonly AgentActivity[];
  readonly trend: readonly AgentTrendPoint[];
  /** Tells the UI (and the reader of a screenshot) that trend data is seeded. */
  readonly trendIsSeeded: boolean;
  readonly generatedAt: Date;
}

/* -------------------------------------------------------------------------
 * Tiles
 * ---------------------------------------------------------------------- */

interface TileDefinition {
  readonly label: string;
  readonly description: string;
  readonly tone: Tone;
  readonly href: string;
}

export const AGENT_TILE_META: Record<AgentTileId, TileDefinition> = {
  assigned: {
    label: "My conversations",
    description: "Assigned to you and waiting on a reply.",
    tone: "primary",
    href: "/inbox?view=assigned",
  },
  unassigned: {
    label: "Unassigned",
    description: "Nobody owns these yet - claim one.",
    tone: "info",
    href: "/inbox?view=unassigned",
  },
  needs_review: {
    label: "Needs review",
    description: "Flagged for a quality check.",
    tone: "neutral",
    href: "/inbox?view=review",
  },
  sla_at_risk: {
    label: "SLA at risk",
    description: "Close to breaching the first-response target.",
    tone: "warning",
    href: "/inbox?view=all&sla=warning",
  },
  sla_breached: {
    label: "SLA breached",
    description: "Past the first-response target.",
    tone: "critical",
    href: "/inbox?view=all&sla=breached",
  },
  awaiting_customer: {
    label: "Awaiting customer",
    description: "You replied; the ball is with them.",
    tone: "private",
    href: "/inbox?view=awaiting",
  },
  escalated: {
    label: "Escalated",
    description: "Handed to a supervisor.",
    tone: "critical",
    href: "/inbox?view=escalated",
  },
};

export function agentTilesFromCounts(counts: Readonly<Record<AgentTileId, number>>): readonly AgentTile[] {
  return AGENT_TILE_IDS.map((id) => ({
    id,
    label: AGENT_TILE_META[id].label,
    description: AGENT_TILE_META[id].description,
    tone: AGENT_TILE_META[id].tone,
    href: AGENT_TILE_META[id].href,
    count: counts[id],
  }));
}

/* -------------------------------------------------------------------------
 * Metrics
 * ---------------------------------------------------------------------- */

export interface AgentMetricInput {
  readonly conversationsAssigned: number;
  readonly firstResponseSamples: readonly number[];
  readonly resolvedCount: number;
  readonly handledCount: number;
  readonly notesAdded: number;
  readonly repliesSent: number;
  readonly aiSuggestionsUsed: number;
}

export function averageOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

function ratioOf(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

/**
 * Response metrics. Averages come from real response intervals in minutes;
 * ratios are normalised against the largest value so the bar chart is legible
 * without pretending to be a chart library.
 */
export function agentMetricsFrom(input: AgentMetricInput): readonly AgentMetric[] {
  const averageFirstResponse = averageOf(input.firstResponseSamples);
  const resolutionRate =
    input.handledCount === 0 ? 0 : Math.round((input.resolvedCount / input.handledCount) * 100);

  const raw: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly hint: string;
    readonly tone: Tone;
    /** The same quantity as a number, used only to scale the bar. */
    readonly numeric: number;
  }> = [
    {
      id: "assigned",
      label: "Assigned",
      value: String(input.conversationsAssigned),
      hint: "Conversations you own right now",
      tone: "primary",
      numeric: input.conversationsAssigned,
    },
    {
      id: "first_response",
      label: "Avg first response",
      value: averageFirstResponse === null ? "No data" : formatDuration(averageFirstResponse * MINUTE_MS),
      hint: "Mean time from first contact to your reply",
      tone: averageFirstResponse !== null && averageFirstResponse <= 15 ? "success" : "warning",
      numeric: averageFirstResponse ?? 0,
    },
    {
      id: "resolution_rate",
      label: "Resolution rate",
      value: `${resolutionRate}%`,
      hint: `${input.resolvedCount} of ${input.handledCount} handled conversations resolved`,
      tone: resolutionRate >= 60 ? "success" : "neutral",
      numeric: resolutionRate,
    },
    {
      id: "replies",
      label: "Replies sent",
      value: String(input.repliesSent),
      hint: "Public and private replies today",
      tone: "info",
      numeric: input.repliesSent,
    },
    {
      id: "notes",
      label: "Internal notes",
      value: String(input.notesAdded),
      hint: "Notes added today - never seen by customers",
      tone: "internal",
      numeric: input.notesAdded,
    },
    {
      id: "ai_used",
      label: "AI drafts used",
      value: String(input.aiSuggestionsUsed),
      hint: "AI suggestions you edited and sent yourself",
      tone: "ai",
      numeric: input.aiSuggestionsUsed,
    },
  ];

  const max = Math.max(1, ...raw.map((metric) => metric.numeric));

  return raw.map((metric) => ({
    id: metric.id,
    label: metric.label,
    value: metric.value,
    hint: metric.hint,
    tone: metric.tone,
    ratio: ratioOf(metric.numeric, max),
  }));
}

/* -------------------------------------------------------------------------
 * Activity
 * ---------------------------------------------------------------------- */

export const AGENT_ACTIVITY_LABELS: Record<AgentActivityKind, string> = {
  replied: "Replied",
  noted: "Added a note",
  assigned: "Changed assignment",
  escalated: "Escalated",
  resolved: "Resolved",
  ai_assisted: "Used AI assistance",
};

export function agentActivityTone(kind: AgentActivityKind): Tone {
  switch (kind) {
    case "replied":
      return "public";
    case "noted":
      return "internal";
    case "assigned":
      return "info";
    case "escalated":
      return "critical";
    case "resolved":
      return "success";
    case "ai_assisted":
      return "ai";
  }
}

/* -------------------------------------------------------------------------
 * Serialisation
 * ---------------------------------------------------------------------- */

export interface AgentActivityDto extends Omit<AgentActivity, "at"> {
  readonly at: string;
}

export interface AgentDashboardDto {
  readonly agent: { readonly id: string; readonly name: string; readonly role: string };
  readonly tiles: readonly AgentTile[];
  readonly metrics: readonly AgentMetric[];
  readonly today: AgentDashboard["today"];
  readonly activity: readonly AgentActivityDto[];
  readonly trend: readonly AgentTrendPoint[];
  readonly trendIsSeeded: boolean;
  readonly generatedAt: string;
}

export function toAgentDashboardDto(dashboard: AgentDashboard): AgentDashboardDto {
  return {
    agent: dashboard.agent,
    tiles: dashboard.tiles,
    metrics: dashboard.metrics,
    today: dashboard.today,
    activity: dashboard.activity.map((entry) => ({ ...entry, at: entry.at.toISOString() })),
    trend: dashboard.trend,
    trendIsSeeded: dashboard.trendIsSeeded,
    generatedAt: dashboard.generatedAt.toISOString(),
  };
}

/** Label for a channel id, reused by the activity list. */
export function activityChannelLabel(channel: ChannelId): string {
  return CHANNEL_LABELS[channel];
}