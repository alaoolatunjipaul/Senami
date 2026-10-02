import { CHANNELS, type ChannelId } from "@/lib/config";
import { channelLabel } from "@/lib/domain/channel-visuals";
import { MONTH_MS, WEEK_MS } from "@/lib/format";
import {
  evaluateSla,
  getSlaPolicy,
  SLA_STATE_LABEL,
  type SlaEvaluation,
  type SlaState,
} from "@/lib/domain/sla";
import {
  CONVERSATION_STATUSES,
  INTENTS,
  INTENT_META,
  PRIORITIES,
  PRIORITY_META,
  SENTIMENTS,
  SENTIMENT_META,
  type ConversationStatus,
  type Intent,
  type Priority,
  type Sentiment,
} from "@/lib/domain/taxonomy";

/**
 * Inbox domain.
 *
 * The inbox reads a flat list of conversation summaries and answers four
 * questions purely: how a conversation is filtered, how the SLA state is
 * derived, how rows are ordered, and how a record is serialised to the client.
 * Keeping this here means the server store, the API and the UI all apply the
 * exact same rules, and the rules can be tested without a database or a clock.
 */

export interface InboxCustomer {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
}

export interface InboxAssignee {
  readonly id: string;
  readonly name: string;
  readonly teamId: string;
  readonly teamName: string;
}

export interface InboxConversation {
  readonly id: string;
  readonly interactionId?: string;
  readonly channel: ChannelId;
  readonly customer: InboxCustomer;
  /** When the customer first reached out; the SLA clock starts here. */
  readonly receivedAt: Date;
  /** Most recent message in the thread; ordering and "date" filters use it. */
  readonly lastMessageAt: Date;
  /** When an agent first replied, if any. Null means the SLA clock is open. */
  readonly respondedAt: Date | null;
  readonly preview: string;
  readonly intent: Intent;
  readonly sentiment: Sentiment;
  readonly priority: Priority;
  readonly status: ConversationStatus;
  readonly slaPaused: boolean;
  readonly needsReview: boolean;
  readonly assignedTo: InboxAssignee | null;
  readonly unread: boolean;
}

/* -------------------------------------------------------------------------
 * Views (the saved filters across the top of the inbox)
 * ---------------------------------------------------------------------- */

export const INBOX_VIEWS = ["all", "assigned", "unassigned", "review", "priority", "awaiting", "escalated"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

export const INBOX_VIEW_LABELS: Record<InboxView, string> = {
  all: "All conversations",
  assigned: "Assigned to Me",
  unassigned: "Unassigned",
  review: "Needs Review",
  priority: "Priority",
  awaiting: "Awaiting Customer",
  escalated: "Escalated",
};

/* -------------------------------------------------------------------------
 * Filters
 * ---------------------------------------------------------------------- */

export const DATE_PRESETS = ["any", "today", "yesterday", "week", "thisWeek", "lastWeek", "month", "thisMonth", "lastMonth", "older_month", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  any: "Any time",
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days",
  thisWeek: "This week",
  lastWeek: "Last week",
  month: "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Last month",
  older_month: "Older than 30 days",
  custom: "Custom range",
};

export interface InboxQuery {
  readonly view: InboxView;
  readonly channels: readonly ChannelId[];
  readonly intent: Intent | "";
  readonly sentiment: Sentiment | "";
  readonly priority: Priority | "";
  readonly sla: SlaState | "";
  readonly assigneeId: string | "";
  readonly teamId: string | "";
  readonly date: DatePreset;
  readonly search: string;
  /** The signed-in user, used only by the "assigned to me" view. */
  readonly userId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 25;

export const DEFAULT_INBOX_QUERY: InboxQuery = {
  view: "all",
  channels: [],
  intent: "",
  sentiment: "",
  priority: "",
  sla: "",
  assigneeId: "",
  teamId: "",
  date: "any",
  search: "",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

/**
 * Read an `InboxQuery` back out of a URL, so a dashboard tile or a shared link
 * lands on the inbox already filtered. Unknown values are ignored rather than
 * throwing: a stale link should open the inbox, not an error page.
 */
export function inboxQueryFromSearchParams(params: URLSearchParams): InboxQuery {
  const view = params.get("view");
  const channels = params.getAll("channel");
  const intent = params.get("intent");
  const sentiment = params.get("sentiment");
  const priority = params.get("priority");
  const sla = params.get("sla");
  const date = params.get("date");
  const page = Number(params.get("page"));

  return {
    view: (INBOX_VIEWS as readonly string[]).includes(view ?? "") ? (view as InboxView) : "all",
    channels: channels.filter((channel): channel is ChannelId => (CHANNELS as readonly string[]).includes(channel)),
    intent: (INTENTS as readonly string[]).includes(intent ?? "") ? (intent as Intent) : "",
    sentiment: (SENTIMENTS as readonly string[]).includes(sentiment ?? "") ? (sentiment as Sentiment) : "",
    priority: (PRIORITIES as readonly string[]).includes(priority ?? "") ? (priority as Priority) : "",
    sla: (SLA_FILTER_STATES as readonly string[]).includes(sla ?? "") ? (sla as SlaState) : "",
    assigneeId: params.get("assignee") ?? "",
    teamId: params.get("team") ?? "",
    date: (DATE_PRESETS as readonly string[]).includes(date ?? "") ? (date as DatePreset) : "any",
    search: params.get("q") ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export const INTENT_OPTIONS = INTENTS.map((intent) => ({ value: intent, label: INTENT_META[intent] }));
export const SENTIMENT_OPTIONS = SENTIMENTS.map((sentiment) => ({
  value: sentiment,
  label: SENTIMENT_META[sentiment].label,
}));
export const PRIORITY_OPTIONS = PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_META[priority].label,
}));
export const SLA_OPTIONS: ReadonlyArray<{ value: SlaState; label: string }> = [
  "safe",
  "warning",
  "breached",
  "met",
  "paused",
].map((state) => ({ value: state as SlaState, label: SLA_STATE_LABEL[state as SlaState] }));

export const SLA_FILTER_STATES: readonly SlaState[] = SLA_OPTIONS.map((option) => option.value);

export const CONVERSATION_STATUS_OPTIONS = CONVERSATION_STATUSES;

/* -------------------------------------------------------------------------
 * Filter options offered to the UI
 * ---------------------------------------------------------------------- */

export interface InboxLabeledOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface InboxFilterOptions {
  readonly channels: ReadonlyArray<InboxLabeledOption<ChannelId>>;
  readonly intents: ReadonlyArray<InboxLabeledOption<Intent>>;
  readonly sentiments: ReadonlyArray<InboxLabeledOption<Sentiment>>;
  readonly priorities: ReadonlyArray<InboxLabeledOption<Priority>>;
  readonly slaStates: ReadonlyArray<InboxLabeledOption<SlaState>>;
  readonly assignees: ReadonlyArray<{ readonly id: string; readonly name: string; readonly teamName: string }>;
  readonly teams: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

/* -------------------------------------------------------------------------
 * Pure logic
 * ---------------------------------------------------------------------- */

function asDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export interface SlaEvaluationInput {
  readonly receivedAt: Date | string;
  readonly respondedAt: Date | string | null;
  readonly priority: Priority;
  readonly slaPaused: boolean;
}

/**
 * Evaluate a conversation's SLA from real timestamps and its priority policy.
 * Accepts either a domain record (Date fields) or a serialised DTO (ISO
 * strings) so the server and the client share one implementation (§24).
 */
export function slaEvaluationOf(item: SlaEvaluationInput, now: Date = new Date()): SlaEvaluation {
  return evaluateSla({
    policy: getSlaPolicy(item.priority),
    startedAt: asDate(item.receivedAt),
    firstRespondedAt: item.respondedAt ? asDate(item.respondedAt) : null,
    paused: item.slaPaused,
    now,
  });
}

/** Whether a conversation textually matches a (lower-cased) search term. */
export function conversationContainsText(item: InboxConversation, term: string): boolean {
  const haystack = [
    item.customer.name,
    item.customer.handle,
    item.preview,
    INTENT_META[item.intent],
    item.id,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

/**
 * Whether a timestamp falls inside a date preset. Exported so other consoles
 * (supervisor audit, QA) share the one definition of "today" and "last 7 days"
 * rather than each re-deriving it.
 */
export function withinDatePreset(preset: DatePreset, at: Date, now: Date): boolean {
    switch (preset) {
      case "any":
        return true;
      case "today": {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        return at.getTime() >= startOfDay.getTime() && at.getTime() < endOfDay.getTime();
      }
      case "yesterday": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 1);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return at.getTime() >= start.getTime() && at.getTime() < end.getTime();
      }
      case "thisWeek": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const day = start.getDay();
        const diff = start.getDate() - day;
        start.setDate(diff);
        return at.getTime() >= start.getTime();
      }
      case "lastWeek": {
        const end = new Date(now);
        end.setHours(0, 0, 0, 0);
        const day = end.getDay();
        end.setDate(end.getDate() - day);
        const start = new Date(end);
        start.setDate(start.getDate() - 7);
        return at.getTime() >= start.getTime() && at.getTime() < end.getTime();
      }
      case "thisMonth": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return at.getTime() >= start.getTime();
      }
      case "lastMonth": {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        return at.getTime() >= start.getTime() && at.getTime() < end.getTime();
      }
      case "week":
        return at.getTime() >= now.getTime() - WEEK_MS;
      case "month":
        return at.getTime() >= now.getTime() - MONTH_MS;
      case "older_month":
        return at.getTime() < now.getTime() - MONTH_MS;
      case "custom":
        return true;
    }
  }

/**
 * The one predicate the whole inbox relies on. Every dimension is applied
 * conjunctively; an empty value means "no constraint" so a filter is only
 * active when the user chose one.
 */
export function matchesInboxQuery(
  item: InboxConversation,
  query: InboxQuery,
  now: Date = new Date(),
): boolean {
  switch (query.view) {
    case "assigned":
      if (query.userId === undefined || item.assignedTo?.id !== query.userId) return false;
      break;
    case "unassigned":
      if (item.assignedTo !== null) return false;
      break;
    case "review":
      if (!item.needsReview) return false;
      break;
    case "priority":
      if (item.priority !== "high" && item.priority !== "critical") return false;
      break;
    case "awaiting":
      if (item.status !== "awaiting_customer") return false;
      break;
    case "escalated":
      if (item.status !== "escalated") return false;
      break;
    case "all":
      break;
  }

  if (query.channels.length > 0 && !query.channels.includes(item.channel)) return false;
  if (query.intent !== "" && item.intent !== query.intent) return false;
  if (query.sentiment !== "" && item.sentiment !== query.sentiment) return false;
  if (query.priority !== "" && item.priority !== query.priority) return false;
  if (query.assigneeId !== "" && item.assignedTo?.id !== query.assigneeId) return false;
  if (query.teamId !== "" && item.assignedTo?.teamId !== query.teamId) return false;
  if (query.sla !== "" && slaEvaluationOf(item, now).state !== query.sla) return false;

  if (!withinDatePreset(query.date, item.lastMessageAt, now)) return false;

  const term = query.search.trim().toLowerCase();
  if (term !== "" && !conversationContainsText(item, term)) return false;

  return true;
}

/** Most recent first, with a stable tiebreak so pagination never reshuffles. */
export function compareByRecency(a: InboxConversation, b: InboxConversation): number {
  const byLastMessage = b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  if (byLastMessage !== 0) return byLastMessage;
  const byReceived = b.receivedAt.getTime() - a.receivedAt.getTime();
  if (byReceived !== 0) return byReceived;
  return a.id.localeCompare(b.id);
}

/* -------------------------------------------------------------------------
 * Serialisation (Date -> ISO) across the API boundary
 * ---------------------------------------------------------------------- */

export interface InboxConversationDto {
  readonly id: string;
  readonly interactionId?: string;
  readonly channel: ChannelId;
  readonly channelLabel?: string;
  readonly customer: InboxCustomer;
  readonly receivedAt: string;
  readonly lastMessageAt: string;
  readonly respondedAt: string | null;
  readonly preview: string;
  readonly intent: Intent;
  readonly sentiment: Sentiment;
  readonly priority: Priority;
  readonly status: ConversationStatus;
  readonly sla?: SlaEvaluation;
  readonly slaPaused: boolean;
  readonly needsReview: boolean;
  readonly assignedTo: InboxAssignee | null;
  readonly unread: boolean;
}

export function toInboxConversationDto(item: InboxConversation): InboxConversationDto {
  return {
    id: item.id,
    interactionId: item.interactionId ?? `INT-${item.id}`,
    channel: item.channel,
    channelLabel: channelLabel(item.channel),
    customer: item.customer,
    receivedAt: item.receivedAt.toISOString(),
    lastMessageAt: item.lastMessageAt.toISOString(),
    respondedAt: item.respondedAt ? item.respondedAt.toISOString() : null,
    preview: item.preview,
    intent: item.intent,
    sentiment: item.sentiment,
    priority: item.priority,
    status: item.status,
    sla: evaluateSla({ policy: { firstResponseMinutes: 15, warningMinutes: 5 }, startedAt: item.receivedAt, firstRespondedAt: item.respondedAt }),
    slaPaused: item.slaPaused,
    needsReview: item.needsReview,
    assignedTo: item.assignedTo,
    unread: item.unread,
  };
}

export interface InboxListResponse {
  readonly items: readonly InboxConversationDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly options: InboxFilterOptions;
}