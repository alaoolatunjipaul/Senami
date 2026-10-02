import { CHANNELS, CHANNEL_LABELS, type ChannelId } from "@/lib/config";
import { slaEvaluationOf, type InboxConversation, type InboxFilterOptions } from "@/lib/domain/inbox";
import type { SupervisorKpi } from "@/lib/domain/supervisor-kpi";
import type { AgentWorkload } from "@/lib/domain/supervisor-workload";
import { SLA_STATE_LABEL, type SlaEvaluation, type SlaState } from "@/lib/domain/sla";
import {
  CONVERSATION_STATUSES,
  CONVERSATION_STATUS_META,
  PRIORITIES,
  type ConversationStatus,
  type Priority,
} from "@/lib/domain/taxonomy";
import type { Tone } from "@/lib/domain/taxonomy";
import { MINUTE_MS } from "@/lib/format";

/**
 * Supervisor operations domain (§26).
 *
 * Everything on the supervisor console is an *aggregation* over the same
 * conversation records the inbox and the conversation workspace already use. It
 * holds no state of its own: when a supervisor reassigns a conversation, every
 * tile, row, workload figure and count here changes with it, because they are
 * all recomputed from that one record (§38).
 *
 * SLA values are never recomputed here. They come from `lib/domain/sla.ts` via
 * `slaEvaluationOf`, so the supervisor console and the agent inbox can never
 * disagree about a deadline (§16).
 */

/* -------------------------------------------------------------------------
 * Agent presence
 * ---------------------------------------------------------------------- */

export const AGENT_PRESENCE_STATES = ["online", "busy", "away", "offline"] as const;
export type AgentPresence = (typeof AGENT_PRESENCE_STATES)[number];

export const AGENT_PRESENCE_META: Record<AgentPresence, { readonly label: string; readonly tone: Tone }> = {
  online: { label: "Online", tone: "success" },
  busy: { label: "Busy", tone: "critical" },
  away: { label: "Away", tone: "warning" },
  offline: { label: "Offline", tone: "neutral" },
};

/** Presence states that count towards available capacity. */
export const WORKING_PRESENCE: readonly AgentPresence[] = ["online", "busy", "away"];

export interface AgentPresenceRecord {
  readonly agentId: string;
  readonly presence: AgentPresence;
}

/**
 * Presence plus the two facts a supervisor needs alongside it. Declared here
 * rather than in the server roster so API response types can reference it without
 * a client component importing server code.
 */
export interface SupervisorRosterEntry extends AgentPresenceRecord {
  readonly agentId: string;
  readonly agentName: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly presence: AgentPresence;
  readonly presenceLabel: string;
  /** Conversations this agent is expected to hold concurrently. */
  readonly capacity: number;
}

/* -------------------------------------------------------------------------
 * Status vocabulary
 * ---------------------------------------------------------------------- */

/** Statuses that still need an agent or a customer response. */
export const ACTIVE_STATUSES: readonly ConversationStatus[] = ["open", "pending", "awaiting_customer"];

/** Statuses that are finished from an operations point of view. */
export const CLOSED_STATUSES: readonly ConversationStatus[] = ["resolved", "closed"];

export function isActiveStatus(status: ConversationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isClosedStatus(status: ConversationStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

/**
 * `active` and `waiting` are roll-ups rather than conversation statuses, so the
 * queue filter offers them alongside the five real statuses.
 */
export const QUEUE_STATUS_FILTERS = [...CONVERSATION_STATUSES, "active", "waiting"] as const;
export type QueueStatusFilter = (typeof QUEUE_STATUS_FILTERS)[number];

export const QUEUE_STATUS_FILTER_LABELS: Record<QueueStatusFilter, string> = {
  open: CONVERSATION_STATUS_META.open.label,
  pending: CONVERSATION_STATUS_META.pending.label,
  awaiting_customer: CONVERSATION_STATUS_META.awaiting_customer.label,
  escalated: CONVERSATION_STATUS_META.escalated.label,
  resolved: CONVERSATION_STATUS_META.resolved.label,
  closed: CONVERSATION_STATUS_META.closed.label,
  active: "All active",
  waiting: "Waiting on customer",
};

export const QUEUE_STATUS_OPTIONS: ReadonlyArray<{ value: QueueStatusFilter; label: string }> =
  QUEUE_STATUS_FILTERS.map((value) => ({ value, label: QUEUE_STATUS_FILTER_LABELS[value] }));

/* -------------------------------------------------------------------------
 * Assignment and escalation filter vocabularies
 * ---------------------------------------------------------------------- */

export const QUEUE_ASSIGNMENT_FILTERS = ["all", "assigned", "unassigned"] as const;
export type QueueAssignmentFilter = (typeof QUEUE_ASSIGNMENT_FILTERS)[number];

export const QUEUE_ASSIGNMENT_LABELS: Record<QueueAssignmentFilter, string> = {
  all: "All conversations",
  assigned: "Assigned",
  unassigned: "Unassigned",
};

export const QUEUE_ESCALATION_FILTERS = ["all", "escalated", "not_escalated"] as const;
export type QueueEscalationFilter = (typeof QUEUE_ESCALATION_FILTERS)[number];

export const QUEUE_ESCALATION_LABELS: Record<QueueEscalationFilter, string> = {
  all: "Any escalation state",
  escalated: "Escalated",
  not_escalated: "Not escalated",
};

export const SLA_FILTER_STATES: readonly SlaState[] = [
  "safe",
  "warning",
  "breached",
  "met",
  "paused",
];

export const SLA_FILTER_OPTIONS: ReadonlyArray<{ value: SlaState; label: string }> = SLA_FILTER_STATES.map(
  (state) => ({ value: state, label: SLA_STATE_LABEL[state] }),
);

/* -------------------------------------------------------------------------
 * Queue row
 * ---------------------------------------------------------------------- */

/**
 * One row of the supervisor team queue: a flattened projection of an
 * `InboxConversation` plus the SLA evaluation the operator needs, so the table
 * never recomputes a deadline in the browser.
 */
export interface SupervisorQueueRow {
  readonly id: string;
  readonly channel: ChannelId;
  readonly channelLabel: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly customerHandle: string;
  readonly preview: string;
  readonly intent: string;
  readonly priority: Priority;
  readonly status: ConversationStatus;
  readonly escalated: boolean;
  readonly needsReview: boolean;
  readonly slaPaused: boolean;
  readonly unread: boolean;
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly receivedAt: Date;
  readonly lastMessageAt: Date;
  readonly respondedAt: Date | null;
  /**
   * Freshest known moment in the thread. The inbox record carries no separate
   * status timestamp, so this is the honest approximation and is used only for
   * "how long has this been waiting" measures, never for an SLA deadline.
   */
  readonly statusChangedAt: Date;
  /** Minutes since the customer first reached out. */
  readonly ageMinutes: number;
  /** Minutes since the last message in the thread. */
  readonly idleMinutes: number;
  /** Minutes to the first agent reply, when one was sent. */
  readonly firstResponseMinutes: number | null;
  readonly sla: SlaEvaluation;
}

/** Severity order behind the "needs attention first" queue ordering. */
const SLA_SEVERITY: Record<SlaState, number> = {
  breached: 0,
  warning: 1,
  safe: 2,
  paused: 3,
  met: 4,
};

const PRIORITY_SEVERITY: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  normal: 3,
  low: 4,
};

export function supervisorQueueRowOf(
  conversation: InboxConversation,
  now: Date = new Date(),
): SupervisorQueueRow {
  const respondedAt = conversation.respondedAt;

  return {
    id: conversation.id,
    channel: conversation.channel,
    channelLabel: CHANNEL_LABELS[conversation.channel],
    customerId: conversation.customer.id,
    customerName: conversation.customer.name,
    customerHandle: conversation.customer.handle,
    preview: conversation.preview,
    intent: conversation.intent,
    priority: conversation.priority,
    status: conversation.status,
    escalated: conversation.status === "escalated",
    needsReview: conversation.needsReview,
    slaPaused: conversation.slaPaused,
    unread: conversation.unread,
    assigneeId: conversation.assignedTo?.id ?? null,
    assigneeName: conversation.assignedTo?.name ?? null,
    teamId: conversation.assignedTo?.teamId ?? null,
    teamName: conversation.assignedTo?.teamName ?? null,
    receivedAt: conversation.receivedAt,
    lastMessageAt: conversation.lastMessageAt,
    respondedAt,
    statusChangedAt: conversation.lastMessageAt,
    ageMinutes: Math.max(0, Math.round((now.getTime() - conversation.receivedAt.getTime()) / MINUTE_MS)),
    idleMinutes: Math.max(0, Math.round((now.getTime() - conversation.lastMessageAt.getTime()) / MINUTE_MS)),
    firstResponseMinutes: respondedAt
      ? Math.max(0, Math.round((respondedAt.getTime() - conversation.receivedAt.getTime()) / MINUTE_MS))
      : null,
    sla: slaEvaluationOf(conversation, now),
  };
}

export function supervisorQueueRows(
  conversations: readonly InboxConversation[],
  now: Date = new Date(),
): readonly SupervisorQueueRow[] {
  return conversations.map((conversation) => supervisorQueueRowOf(conversation, now));
}

/* -------------------------------------------------------------------------
 * Queue query
 * ---------------------------------------------------------------------- */

export const QUEUE_SORTS = ["urgency", "newest", "oldest", "sla_remaining"] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];

export const QUEUE_SORT_LABELS: Record<QueueSort, string> = {
  urgency: "Needs attention first",
  newest: "Most recent activity",
  oldest: "Oldest first",
  sla_remaining: "SLA closest to breach",
};

export const SUPERVISOR_DEFAULT_PAGE_SIZE = 25;

export interface SupervisorQueueQuery {
  readonly status: QueueStatusFilter | "";
  readonly assignment: QueueAssignmentFilter;
  readonly priority: Priority | "";
  readonly sla: SlaState | "";
  readonly channels: readonly ChannelId[];
  readonly assigneeId: string;
  readonly teamId: string;
  readonly escalation: QueueEscalationFilter;
  readonly search: string;
  readonly sort: QueueSort;
  readonly page: number;
  readonly pageSize: number;
}

export const DEFAULT_SUPERVISOR_QUEUE_QUERY: SupervisorQueueQuery = {
  status: "",
  assignment: "all",
  priority: "",
  sla: "",
  channels: [],
  assigneeId: "",
  teamId: "",
  escalation: "all",
  search: "",
  sort: "urgency",
  page: 1,
  pageSize: SUPERVISOR_DEFAULT_PAGE_SIZE,
};

/**
 * Read a queue query back out of a URL so a dashboard tile or a shared link
 * lands pre-filtered. Unknown values fall back to the default rather than
 * throwing: a stale link opens the queue, not an error page.
 */
export function supervisorQueueQueryFromSearchParams(params: URLSearchParams): SupervisorQueueQuery {
  const status = params.get("status") ?? "";
  const assignment = params.get("assignment") ?? "";
  const priority = params.get("priority") ?? "";
  const sla = params.get("sla") ?? "";
  const escalation = params.get("escalation") ?? "";
  const sort = params.get("sort") ?? "";
  const page = Number(params.get("page"));

  return {
    status: (QUEUE_STATUS_FILTERS as readonly string[]).includes(status)
      ? (status as QueueStatusFilter)
      : "",
    assignment: (QUEUE_ASSIGNMENT_FILTERS as readonly string[]).includes(assignment)
      ? (assignment as QueueAssignmentFilter)
      : "all",
    priority: (PRIORITIES as readonly string[]).includes(priority) ? (priority as Priority) : "",
    sla: (SLA_FILTER_STATES as readonly string[]).includes(sla) ? (sla as SlaState) : "",
    channels: params
      .getAll("channel")
      .filter((channel): channel is ChannelId => (CHANNELS as readonly string[]).includes(channel)),
    assigneeId: params.get("assignee") ?? "",
    teamId: params.get("team") ?? "",
    escalation: (QUEUE_ESCALATION_FILTERS as readonly string[]).includes(escalation)
      ? (escalation as QueueEscalationFilter)
      : "all",
    search: params.get("q") ?? "",
    sort: (QUEUE_SORTS as readonly string[]).includes(sort) ? (sort as QueueSort) : "urgency",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: SUPERVISOR_DEFAULT_PAGE_SIZE,
  };
}

/** Serialise a query back to a URL so filters are shareable and linkable. */
export function supervisorQueueQueryToSearchParams(query: SupervisorQueueQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.status !== "") params.set("status", query.status);
  if (query.assignment !== "all") params.set("assignment", query.assignment);
  if (query.priority !== "") params.set("priority", query.priority);
  if (query.sla !== "") params.set("sla", query.sla);
  for (const channel of query.channels) params.append("channel", channel);
  if (query.assigneeId !== "") params.set("assignee", query.assigneeId);
  if (query.teamId !== "") params.set("team", query.teamId);
  if (query.escalation !== "all") params.set("escalation", query.escalation);
  if (query.search.trim() !== "") params.set("q", query.search.trim());
  if (query.sort !== "urgency") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

/** Whether any dimension other than ordering is narrowing the queue. */
export function hasActiveQueueFilters(query: SupervisorQueueQuery): boolean {
  return (
    query.status !== "" ||
    query.assignment !== "all" ||
    query.priority !== "" ||
    query.sla !== "" ||
    query.channels.length > 0 ||
    query.assigneeId !== "" ||
    query.teamId !== "" ||
    query.escalation !== "all" ||
    query.search.trim() !== ""
  );
}

export function supervisorRowContainsText(row: SupervisorQueueRow, term: string): boolean {
  const haystack = [row.customerName, row.customerHandle, row.preview, row.intent, row.id, row.assigneeName ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

/**
 * The single predicate the supervisor queue relies on. Every dimension is
 * conjunctive, so filters compose; an empty value means "no constraint", which
 * is what makes a filter only active once the operator has chosen one.
 */
export function matchesSupervisorQueueQuery(row: SupervisorQueueRow, query: SupervisorQueueQuery): boolean {
  switch (query.status) {
    case "":
      break;
    case "active":
      if (!isActiveStatus(row.status)) return false;
      break;
    case "waiting":
      if (row.status !== "awaiting_customer") return false;
      break;
    default:
      if (row.status !== query.status) return false;
  }

  if (query.assignment === "assigned" && row.assigneeId === null) return false;
  if (query.assignment === "unassigned" && row.assigneeId !== null) return false;

  if (query.priority !== "" && row.priority !== query.priority) return false;
  if (query.sla !== "" && row.sla.state !== query.sla) return false;
  if (query.channels.length > 0 && !query.channels.includes(row.channel)) return false;
  if (query.assigneeId !== "" && row.assigneeId !== query.assigneeId) return false;
  if (query.teamId !== "" && row.teamId !== query.teamId) return false;

  if (query.escalation === "escalated" && !row.escalated) return false;
  if (query.escalation === "not_escalated" && row.escalated) return false;

  const term = query.search.trim().toLowerCase();
  if (term !== "" && !supervisorRowContainsText(row, term)) return false;

  return true;
}

/** Deterministic ordering, always with an id tiebreak so pages never reshuffle. */
export function compareSupervisorRows(a: SupervisorQueueRow, b: SupervisorQueueRow, sort: QueueSort): number {
  switch (sort) {
    case "newest":
      return b.lastMessageAt.getTime() - a.lastMessageAt.getTime() || a.id.localeCompare(b.id);
    case "oldest":
      return a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id);
    case "sla_remaining":
      return a.sla.remainingMs - b.sla.remainingMs || a.id.localeCompare(b.id);
    case "urgency": {
      const bySla = SLA_SEVERITY[a.sla.state] - SLA_SEVERITY[b.sla.state];
      if (bySla !== 0) return bySla;
      const byPriority = PRIORITY_SEVERITY[a.priority] - PRIORITY_SEVERITY[b.priority];
      if (byPriority !== 0) return byPriority;
      // Oldest first breaks the tie: that conversation has waited longest.
      return a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id);
    }
  }
}

/** Filter then order a set of rows. Shared by the queue and the SLA page. */
export function selectSupervisorRows(
  rows: readonly SupervisorQueueRow[],
  query: SupervisorQueueQuery,
): readonly SupervisorQueueRow[] {
  return rows.filter((row) => matchesSupervisorQueueQuery(row, query)).sort((a, b) => compareSupervisorRows(a, b, query.sort));
}

/* -------------------------------------------------------------------------
 * Serialisation (Date -> ISO) across the API boundary
 * ---------------------------------------------------------------------- */

/**
 * A queue row as it travels to the browser. Only the three timestamps become
 * strings; the SLA evaluation keeps its shape so the client can render the same
 * state the server computed rather than re-deriving a deadline (§24).
 */
export interface SupervisorQueueRowDto {
  readonly id: string;
  readonly channel: ChannelId;
  readonly channelLabel: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly customerHandle: string;
  readonly preview: string;
  readonly intent: string;
  readonly priority: Priority;
  readonly status: ConversationStatus;
  readonly escalated: boolean;
  readonly needsReview: boolean;
  readonly slaPaused: boolean;
  readonly unread: boolean;
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly receivedAt: string;
  readonly lastMessageAt: string;
  readonly respondedAt: string | null;
  readonly statusChangedAt: string;
  readonly ageMinutes: number;
  readonly idleMinutes: number;
  readonly firstResponseMinutes: number | null;
  readonly sla: {
    readonly deadline: string;
    readonly warningAt: string;
    readonly remainingMs: number;
    readonly overdueMs: number;
    readonly state: SlaState;
    readonly label: string;
    readonly firstRespondedAt: string | null;
  };
}

export function toSupervisorQueueRowDto(row: SupervisorQueueRow): SupervisorQueueRowDto {
  return {
    id: row.id,
    channel: row.channel,
    channelLabel: row.channelLabel,
    customerId: row.customerId,
    customerName: row.customerName,
    customerHandle: row.customerHandle,
    preview: row.preview,
    intent: row.intent,
    priority: row.priority,
    status: row.status,
    escalated: row.escalated,
    needsReview: row.needsReview,
    slaPaused: row.slaPaused,
    unread: row.unread,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
    teamId: row.teamId,
    teamName: row.teamName,
    receivedAt: row.receivedAt.toISOString(),
    lastMessageAt: row.lastMessageAt.toISOString(),
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
    statusChangedAt: row.statusChangedAt.toISOString(),
    ageMinutes: row.ageMinutes,
    idleMinutes: row.idleMinutes,
    firstResponseMinutes: row.firstResponseMinutes,
    sla: {
      deadline: row.sla.deadline.toISOString(),
      warningAt: row.sla.warningAt.toISOString(),
      remainingMs: row.sla.remainingMs,
      overdueMs: row.sla.overdueMs,
      state: row.sla.state,
      label: row.sla.label,
      firstRespondedAt: row.sla.firstRespondedAt ? row.sla.firstRespondedAt.toISOString() : null,
    },
  };
}

export interface SupervisorQueuePage {
  readonly items: readonly SupervisorQueueRowDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

/**
 * Page a filtered, ordered result set. Filtering and ordering always happen
 * before slicing, so `total` describes the whole match set and the page controls
 * can show how much is really there.
 */
export function toSupervisorQueuePage(
  rows: readonly SupervisorQueueRow[],
  query: SupervisorQueueQuery,
): SupervisorQueuePage {
  const selected = selectSupervisorRows(rows, query);
  const pageSize = Math.max(1, query.pageSize);
  const pageCount = Math.max(1, Math.ceil(selected.length / pageSize));
  // A page beyond the end is clamped instead of returning an empty table, so an
  // operator who deletes rows on another page keeps seeing the last page.
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * pageSize;

  return {
    items: selected.slice(start, start + pageSize).map(toSupervisorQueueRowDto),
    total: selected.length,
    page,
    pageSize,
    pageCount,
  };
}

/* -------------------------------------------------------------------------
 * Response shapes
 * ---------------------------------------------------------------------- */

/** Shared filter options, so every supervisor table offers the same vocabulary. */
export interface SupervisorQueueListResponse {
  readonly page: SupervisorQueuePage;
  /** Tiles are included so the page header and the queue agree on the figures. */
  readonly kpis: readonly SupervisorKpi[];
  readonly options: InboxFilterOptions;
  readonly roster: readonly SupervisorRosterEntry[];
}

export interface SupervisorTeamResponse {
  readonly workloads: readonly AgentWorkload[];
  readonly roster: readonly SupervisorRosterEntry[];
  readonly summary: {
    readonly online: number;
    readonly busy: number;
    readonly away: number;
    readonly offline: number;
    readonly total: number;
  };
  readonly overloaded: number;
  readonly withCapacity: number;
}

export interface SupervisorSlaResponse {
  readonly rows: readonly SupervisorQueueRowDto[];
  readonly counts: Record<SlaState, number>;
  readonly compliance: number | null;
  readonly complianceLabel: string;
  readonly breachRate: number | null;
  readonly breachRateLabel: string;
  readonly note: string;
}

