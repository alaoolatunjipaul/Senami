import {
  AGENT_ACTIVITY_LABELS,
  agentActivityTone,
  agentMetricsFrom,
  agentTilesFromCounts,
  toAgentDashboardDto,
  type AgentActivity,
  type AgentActivityKind,
  type AgentDashboard,
  type AgentDashboardDto,
  type AgentTileId,
  type AgentTrendPoint,
} from "@/lib/domain/agent";
import { hashString } from "@/lib/domain/ai";
import type { AuditEvent, AuditEventType } from "@/lib/domain/conversation";
import { DEFAULT_INBOX_QUERY, slaEvaluationOf, type InboxConversation } from "@/lib/domain/inbox";
import { MINUTE_MS } from "@/lib/domain/sla";
import type { UserProfile } from "@/lib/domain/user";
import { demoConversationStore } from "@/server/conversations/store";
import { demoInboxStore } from "@/server/inbox/store";

/**
 * Agent dashboard store.
 *
 * An aggregation over the same conversation records the inbox serves, so a tile
 * count always matches the list it links to. Today's numbers are counted from
 * the audit trail rather than invented, and only the seven-day trend is seeded -
 * it is flagged with `trendIsSeeded` so the UI can label it honestly (§10).
 */

const TREND_DAYS = 7;
const ACTIVITY_LIMIT = 8;

const ACTIVITY_EVENT_KINDS: Partial<Record<AuditEventType, AgentActivityKind>> = {
  message_public: "replied",
  message_private: "replied",
  note_added: "noted",
  assigned: "assigned",
  reassigned: "assigned",
  unassigned: "assigned",
  escalated: "escalated",
  resolved: "resolved",
  ai_suggested: "ai_assisted",
};

interface AuditedConversation {
  readonly event: AuditEvent;
  readonly conversation: InboxConversation;
}

function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function weekdayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

function allConversations(): readonly InboxConversation[] {
  return demoInboxStore().list({ ...DEFAULT_INBOX_QUERY, pageSize: 1000 }).items;
}

function conversationsFor(agentId: string): readonly InboxConversation[] {
  return allConversations().filter((conversation) => conversation.assignedTo?.id === agentId);
}

/** null means "the whole queue", used for supervisors and administrators. */
function scopedConversations(agentId: string | null): readonly InboxConversation[] {
  return agentId === null ? allConversations() : conversationsFor(agentId);
}

function isLive(conversation: InboxConversation): boolean {
  return conversation.status !== "resolved" && conversation.status !== "closed";
}

function tileCounts(agentId: string | null, now: Date): Readonly<Record<AgentTileId, number>> {
  const all = allConversations();
  const mine = scopedConversations(agentId);

  return {
    assigned: mine.filter(isLive).length,
    unassigned: all.filter((conversation) => conversation.assignedTo === null).length,
    needs_review: mine.filter((conversation) => conversation.needsReview).length,
    sla_at_risk: mine.filter((conversation) => slaEvaluationOf(conversation, now).state === "warning").length,
    sla_breached: mine.filter((conversation) => slaEvaluationOf(conversation, now).state === "breached").length,
    awaiting_customer: mine.filter((conversation) => conversation.status === "awaiting_customer").length,
    escalated: all.filter((conversation) => conversation.status === "escalated").length,
  };
}

/** Audit events for the scoped conversations, most recent first. */
function scopedEvents(agentId: string | null): readonly AuditedConversation[] {
  const store = demoConversationStore();
  const collected: AuditedConversation[] = [];

  for (const conversation of scopedConversations(agentId)) {
    for (const event of store.listAudit(conversation.id)) {
      collected.push({ event, conversation });
    }
  }

  return collected.sort((a, b) => b.event.createdAt.getTime() - a.event.createdAt.getTime());
}

/** Minutes from first contact to the agent's first reply, or null if unanswered. */
function firstResponseMinutes(conversation: InboxConversation): number | null {
  if (conversation.respondedAt === null) return null;
  return Math.round((conversation.respondedAt.getTime() - conversation.receivedAt.getTime()) / MINUTE_MS);
}

function todayCounts(agentId: string | null, now: Date): AgentDashboard["today"] {
  const since = startOfDay(now);
  const conversations = scopedConversations(agentId);

  let repliesSent = 0;
  let notesAdded = 0;
  let conversationsResolved = 0;
  let escalationsRaised = 0;
  let aiSuggestionsUsed = 0;

  for (const { event } of scopedEvents(agentId)) {
    if (event.createdAt.getTime() < since) continue;
    switch (event.type) {
      case "message_public":
      case "message_private":
        repliesSent += 1;
        break;
      case "note_added":
        notesAdded += 1;
        break;
      case "resolved":
        conversationsResolved += 1;
        break;
      case "escalated":
        escalationsRaised += 1;
        break;
      case "ai_suggested":
        aiSuggestionsUsed += 1;
        break;
      default:
        break;
    }
  }

  const respondedToday = conversations
    .filter((conversation) => conversation.respondedAt !== null && conversation.respondedAt.getTime() >= since)
    .map((conversation) => firstResponseMinutes(conversation))
    .filter((minutes): minutes is number => minutes !== null);

  const slaStates = conversations.map((conversation) => slaEvaluationOf(conversation, now).state);

  return {
    repliesSent,
    notesAdded,
    conversationsResolved,
    escalationsRaised,
    aiSuggestionsUsed,
    firstResponseMinutes:
      respondedToday.length === 0
        ? 0
        : Math.round((respondedToday.reduce((total, minutes) => total + minutes, 0) / respondedToday.length) * 10) /
          10,
    slaMetCount: slaStates.filter((state) => state === "met").length,
    slaBreachedCount: slaStates.filter((state) => state === "breached").length,
  };
}

function activityFeed(agentId: string | null, now: Date): readonly AgentActivity[] {
  const since = startOfDay(now);
  const feed: AgentActivity[] = [];

  for (const { event, conversation } of scopedEvents(agentId)) {
    if (feed.length >= ACTIVITY_LIMIT) break;
    if (event.createdAt.getTime() < since) continue;

    const kind = ACTIVITY_EVENT_KINDS[event.type];
    if (kind === undefined) continue;

    feed.push({
      id: event.id,
      kind,
      conversationId: conversation.id,
      conversationLabel: `${conversation.customer.name} · ${conversation.preview}`,
      customerName: conversation.customer.name,
      channel: conversation.channel,
      summary: event.summary.length > 0 ? event.summary : AGENT_ACTIVITY_LABELS[kind],
      at: event.createdAt,
      tone: agentActivityTone(kind),
    });
  }

  return feed;
}

/**
 * Seven seeded days of trend data, deterministic from the agent id and the day
 * offset. Flagged as seeded so nothing presents it as measured history.
 */
function trendFor(agentId: string | null, now: Date): readonly AgentTrendPoint[] {
  const today = startOfDay(now);
  const points: AgentTrendPoint[] = [];

  for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
    const dayStart = today - offset * 86_400_000;
    const seed = hashString(`${agentId ?? "all"}:${isoDate(dayStart)}`);
    points.push({
      date: isoDate(dayStart),
      label: weekdayLabel(dayStart),
      firstResponseMinutes: 6 + (seed % 24),
      conversationsTouched: 4 + (seed % 15),
      resolved: 2 + ((seed >> 3) % 11),
    });
  }

  return points;
}

export function buildAgentDashboard(agent: UserProfile, now: Date = new Date()): AgentDashboard {
  // Agents see their own work; supervisors and admins review the whole queue.
  const scopeAgentId = agent.role === "AGENT" ? agent.id : null;
  const conversations = scopedConversations(scopeAgentId);
  const tiles = agentTilesFromCounts(tileCounts(scopeAgentId, now));
  const today = todayCounts(scopeAgentId, now);

  const firstResponseSamples = conversations
    .map((conversation) => firstResponseMinutes(conversation))
    .filter((minutes): minutes is number => minutes !== null && minutes >= 0);

  const metrics = agentMetricsFrom({
    conversationsAssigned: tiles.find((tile) => tile.id === "assigned")?.count ?? 0,
    firstResponseSamples,
    resolvedCount: conversations.filter((conversation) => !isLive(conversation)).length,
    handledCount: conversations.length,
    notesAdded: today.notesAdded,
    repliesSent: today.repliesSent,
    aiSuggestionsUsed: today.aiSuggestionsUsed,
  });

  return {
    agent: { id: agent.id, name: agent.name, role: agent.role },
    tiles,
    metrics,
    today,
    activity: activityFeed(scopeAgentId, now),
    trend: trendFor(scopeAgentId, now),
    trendIsSeeded: true,
    generatedAt: now,
  };
}

export function agentDashboardDtoFor(agent: UserProfile, now: Date = new Date()): AgentDashboardDto {
  return toAgentDashboardDto(buildAgentDashboard(agent, now));
}