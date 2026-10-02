import { CHANNEL_LABELS } from "@/lib/config";
import {
  AUDIT_EVENT_META,
  MOCK_ATTACHMENTS,
  attachmentKindOf,
  sortTimeline,
  summariseEscalation,
  summariseReopen,
  summariseResolution,
  type AuditEvent,
  type AuditEventType,
  type ConversationMessage,
  type ConversationThreadInfo,
  type CustomerHistory,
  type EscalationReason,
  type MessageAttachment,
  type MessageAuthor,
  type ResolvableStatus,
} from "@/lib/domain/conversation";
import { DEFAULT_INBOX_QUERY, type InboxAssignee, type InboxConversation } from "@/lib/domain/inbox";
import { INTENT_META, PRIORITY_META, type MessageKind, type Priority } from "@/lib/domain/taxonomy";
import { MINUTE_MS } from "@/lib/format";
import { demoInboxStore, resetDemoInboxStore } from "@/server/inbox/store";

/**
 * Conversation workspace store.
 *
 * Extends the deterministic inbox dataset (§47) with the conversation timeline,
 * internal notes, AI suggestions, replies, audit trail and customer history.
 * Like the inbox store it is a process-wide in-memory singleton with the shape
 * of the repository a Prisma/PostgreSQL implementation will satisfy later - it
 * needs no DATABASE_URL to run. No message content is generated from real data
 * and no upload is performed; attachments carry metadata only.
 */

/* -------------------------------------------------------------------------
 * Deterministic helpers
 * ---------------------------------------------------------------------- */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function seedFrom(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(pool: readonly T[], rng: () => number): T {
  const value = pool[Math.floor(rng() * pool.length)];
  if (value === undefined) throw new Error("Cannot pick from an empty pool.");
  return value;
}

/* -------------------------------------------------------------------------
 * Message copy
 * ---------------------------------------------------------------------- */

const AGENT_REPLIES: readonly string[] = [
  "Thanks for reaching out. I'm looking into this now and will update you shortly.",
  "I can see the issue on the account. Let me run through the details and get it resolved for you.",
  "Appreciate your patience. I've raised this with the right team and I'll follow up here.",
  "Good news - I've been able to make the change. It may take a few minutes to show on your side.",
  "I'm sorry for the trouble this caused. I've corrected the account and added a note for our team.",
];

const AGENT_NOTES: readonly string[] = [
  "Checked the transaction log - this matches a known card decline pattern. Confirming with payments.",
  "Customer is on the premium plan; refund already issued in error, needs reversal before closing.",
  "Verified identity against the details on file. Safe to proceed with the address change.",
  "Related to an open case from last week. Linking the two before resolving.",
  "Escalation risk if not answered within the hour. Prioritising this ahead of the queue.",
];

const AI_SUGGESTIONS: readonly string[] = [
  "Suggested reply: apologise for the decline, confirm the card is active, and offer to raise the limit.",
  "Suggested reply: reassure the customer the transfer is processing and give the expected settlement time.",
  "Suggested next step: offer to call the customer back within 10 minutes to verify the account.",
  "Suggested reply: acknowledge the delay, share the reference number, and set expectations for follow-up.",
];

const SYSTEM_AUTHOR: MessageAuthor = { id: "system", name: "System", type: "system" };
const AI_AUTHOR: MessageAuthor = { id: "ai_senami", name: "Senami AI", type: "ai" };

/* -------------------------------------------------------------------------
 * Store contracts
 * ---------------------------------------------------------------------- */

export interface SendMessageInput {
  readonly kind: Extract<MessageKind, "public" | "private" | "internal_note">;
  readonly body: string;
  readonly attachments: readonly MessageAttachment[];
  readonly author: MessageAuthor;
  readonly replyToId?: string | null;
  /**
   * Stable id for one send attempt. A retry with the same value returns the
   * original message instead of sending twice (§42 duplicate-send prevention).
   */
  readonly clientRequestId?: string | null;
}

export interface OpenInput {
  readonly actor: string;
}

export interface DraftEditInput {
  readonly actor: string;
  readonly action: string;
  readonly source: "ai" | "agent";
  readonly characters: number;
}

export interface AiSuggestionInput {
  readonly actor: string;
  readonly action: string;
  readonly suggestionId: string;
}

export interface ResolveInput {
  readonly note: string;
  readonly actor: string;
}

export interface PriorityChangeInput {
  readonly priority: Priority;
  readonly reason: string;
  readonly actor: string;
}

export interface StatusChangeInput {
  readonly status: ResolvableStatus;
  readonly reason: string;
  readonly actor: string;
}

export interface AssignInput {
  readonly assigneeId: string | null;
  readonly actor: string;
}

export interface EscalateInput {
  readonly reason: EscalationReason;
  readonly note: string;
  readonly author: MessageAuthor;
  readonly actor: string;
}

export interface MoveToPrivateInput {
  readonly reason: string;
  readonly greeting: string;
  readonly author: MessageAuthor;
  readonly actor: string;
}

export interface MoveToPrivateResult {
  readonly origin: InboxConversation;
  readonly created: InboxConversation;
  readonly event: AuditEvent;
}

export interface SendMessageResult {
  readonly message: ConversationMessage;
  readonly conversation: InboxConversation;
  /** True when this call matched an earlier send with the same clientRequestId. */
  readonly duplicate: boolean;
}

export interface OpenResult {
  readonly conversation: InboxConversation;
  readonly event: AuditEvent;
  /** False when this agent had already opened the conversation. */
  readonly firstOpen: boolean;
}

export interface DraftEditResult {
  readonly conversation: InboxConversation;
  readonly event: AuditEvent;
}

export interface AiSuggestionResult {
  readonly conversation: InboxConversation;
  readonly event: AuditEvent;
}

export interface StatusChangeResult {
  readonly conversation: InboxConversation;
  readonly event: AuditEvent;
  readonly systemMessage: ConversationMessage;
}

export interface PriorityChangeResult {
  readonly conversation: InboxConversation;
  readonly event: AuditEvent;
}

export interface AssignResult {
  readonly conversation: InboxConversation;
  readonly event: AuditEvent;
}

export interface EscalateResult {
  readonly conversation: InboxConversation;
  readonly message: ConversationMessage;
  readonly event: AuditEvent;
}

export type EscalationOutcome = "resolved" | "reassigned" | "dismissed";

const ESCALATION_OUTCOME_SUMMARY: Record<EscalationOutcome, string> = {
  resolved: "Escalation resolved.",
  reassigned: "Escalation resolved by reassignment.",
  dismissed: "Escalation dismissed.",
};

function escalationOutcomeSummary(outcome: EscalationOutcome): string {
  return ESCALATION_OUTCOME_SUMMARY[outcome];
}

export interface ClearEscalationInput {
  readonly outcome: EscalationOutcome;
  readonly note: string;
  readonly actor: string;
}

export interface ClearQaReviewInput {
  readonly outcome: "approved" | "changes_requested";
  readonly note: string;
  readonly actor: string;
}

export interface SupervisorActionResult {
  readonly conversation: InboxConversation;
  readonly event: AuditEvent;
}

export interface ConversationStore {
  getConversation(id: string): InboxConversation | null;
  threadInfo(id: string): ConversationThreadInfo | null;
  listMessages(id: string): readonly ConversationMessage[];
  listAudit(id: string): readonly AuditEvent[];
  customerHistory(customerId: string): CustomerHistory | null;
  sendMessage(id: string, input: SendMessageInput, now?: Date): SendMessageResult | null;
  assign(id: string, input: AssignInput, now?: Date): AssignResult | null;
  escalate(id: string, input: EscalateInput, now?: Date): EscalateResult | null;
  moveToPrivate(id: string, input: MoveToPrivateInput, now?: Date): MoveToPrivateResult | null;
  /** Record that an agent opened the conversation; repeated opens are ignored. */
  recordOpen(id: string, input: OpenInput, now?: Date): OpenResult | null;
  /** Record an edit to a draft, so the audit trail shows what the agent changed. */
  recordDraftEdit(id: string, input: DraftEditInput, now?: Date): DraftEditResult | null;
  /** Record that AI assistance produced a suggestion. Never a sent message. */
  recordAiSuggestion(id: string, input: AiSuggestionInput, now?: Date): AiSuggestionResult | null;
  resolve(id: string, input: ResolveInput, now?: Date): StatusChangeResult | null;
  setStatus(id: string, input: StatusChangeInput, now?: Date): StatusChangeResult | null;
  /**
   * Raise or lower a conversation's priority (supervisor action, §11). Returns
   * null when the priority is unchanged, so a no-op never fabricates an event.
   */
  changePriority(id: string, input: PriorityChangeInput, now?: Date): PriorityChangeResult | null;
  /**
   * Clear an escalation by returning the conversation to the live queue.
   *
   * Deliberately *not* a resolution: resolving a conversation is a separate
   * authority (`conversation.resolve`) that a supervisor does not hold. Dealing
   * with an escalation only decides it no longer needs supervisor attention.
   */
  clearEscalation(id: string, input: ClearEscalationInput, now?: Date): SupervisorActionResult | null;
  /** Record a QA decision and clear the review flag when the review is approved. */
  clearQaReview(id: string, input: ClearQaReviewInput, now?: Date): SupervisorActionResult | null;
  reset(now?: Date): void;
}

/* -------------------------------------------------------------------------
 * Implementation
 * ---------------------------------------------------------------------- */

interface ThreadState {
  readonly messages: ConversationMessage[];
  readonly audit: AuditEvent[];
}

interface ThreadLink {
  originConversationId: string | null;
  movedToConversationId: string | null;
}

export function buildConversationStore(): ConversationStore {
  let inbox = demoInboxStore();
  const threads = new Map<string, ThreadState>();
  const links = new Map<string, ThreadLink>();
  const sentRequests = new Map<string, ConversationMessage>();
  const openedBy = new Map<string, Set<string>>();
  let dmCounter = 0;
  let eventSeq = 0;

  function authorForAgent(assignee: InboxAssignee | null): MessageAuthor {
    if (!assignee) {
      return { id: "usr_agent_maya", name: "Maya Keller", type: "agent", role: "AGENT", teamName: "Support · EU" };
    }
    return {
      id: assignee.id,
      name: assignee.name,
      type: "agent",
      role: "AGENT",
      teamName: assignee.teamName,
    };
  }

  function attachmentFor(seed: string, rng: () => number): MessageAttachment | null {
    if (rng() > 0.28) return null;
    const sample = pick(MOCK_ATTACHMENTS, rng);
    return {
      id: `${seed}-a0`,
      name: sample.name,
      mimeType: sample.mimeType,
      sizeBytes: sample.sizeBytes,
      url: sample.url,
      kind: attachmentKindOf(sample.mimeType),
    };
  }

  function createAudit(
    conversationId: string,
    type: AuditEventType,
    summary: string,
    actor: string,
    createdAt: Date,
    metadata?: AuditEvent["metadata"],
  ): AuditEvent {
    eventSeq += 1;
    return {
      id: `evt_${conversationId}_${String(eventSeq).padStart(5, "0")}`,
      conversationId,
      type,
      summary,
      actor,
      createdAt,
      metadata,
    };
  }

  function makeMessage(
    conversationId: string,
    seq: number,
    partial: Omit<ConversationMessage, "id" | "conversationId">,
  ): ConversationMessage {
    return { id: `${conversationId}-m${String(seq).padStart(2, "0")}`, conversationId, ...partial };
  }

  function auditForMessage(message: ConversationMessage): AuditEvent | null {
    const type: AuditEventType | null =
      message.kind === "public"
        ? "message_public"
        : message.kind === "private"
          ? "message_private"
          : message.kind === "internal_note"
            ? "note_added"
            : message.kind === "ai_generated"
              ? "ai_suggested"
              : null;
    if (type === null) return null;
    return createAudit(
      message.conversationId,
      type,
      AUDIT_EVENT_META[type].label,
      message.author.name,
      message.createdAt,
      { messageId: message.id },
    );
  }

  /** Build a deterministic thread for a seeded conversation on first access. */
  function buildThread(conversation: InboxConversation): ThreadState {
    const rng = mulberry32(seedFrom(conversation.id));
    const messages: ConversationMessage[] = [];
    const audit: AuditEvent[] = [];
    let seq = 0;

    const push = (partial: Omit<ConversationMessage, "id" | "conversationId">) => {
      const message = makeMessage(conversation.id, seq, partial);
      seq += 1;
      messages.push(message);
      const event = auditForMessage(message);
      if (event) audit.push(event);
      return message;
    };

    const agents = inbox.assignees();
    const agent = authorForAgent(conversation.assignedTo ?? pick(agents, rng));
    const customerAuthor: MessageAuthor = {
      id: conversation.customer.id,
      name: conversation.customer.name,
      type: "customer",
    };
    const at = (base: Date, plusMinutes: number) =>
      new Date(base.getTime() + Math.round(plusMinutes) * MINUTE_MS);

    const t0 = conversation.receivedAt;
    const windowMs = conversation.lastMessageAt.getTime() - t0.getTime();
    const windowMin = windowMs / MINUTE_MS;
    const privateThread = rng() < 0.34;

    audit.push(
      createAudit(
        conversation.id,
        "conversation_created",
        `Conversation created from ${CHANNEL_LABELS[conversation.channel]}`,
        "System",
        t0,
        { channel: conversation.channel, intent: conversation.intent },
      ),
    );

    const firstAttachment = attachmentFor(`${conversation.id}-m00`, rng);
    push({
      kind: privateThread ? "private" : "public",
      direction: "inbound",
      author: customerAuthor,
      body: conversation.preview,
      createdAt: t0,
      attachments: firstAttachment ? [firstAttachment] : [],
      replyToId: null,
      aiConfidence: null,
    });

    if (windowMin >= 12 && rng() < 0.55) {
      push({
        kind: "internal_note",
        direction: "outbound",
        author: agent,
        body: pick(AGENT_NOTES, rng),
        createdAt: at(t0, 4 + Math.floor(rng() * 6)),
        attachments: [],
        replyToId: null,
        aiConfidence: null,
      });
    }

    if (conversation.respondedAt) {
      const respondedAt = conversation.respondedAt;
      const beforeReply = respondedAt.getTime() - t0.getTime();
      if (beforeReply >= 6 * MINUTE_MS && rng() < 0.4) {
        push({
          kind: "ai_generated",
          direction: "outbound",
          author: AI_AUTHOR,
          body: pick(AI_SUGGESTIONS, rng),
          createdAt: at(respondedAt, -4),
          attachments: [],
          replyToId: null,
          aiConfidence: Number((0.62 + rng() * 0.33).toFixed(2)),
        });
      }

      push({
        kind: privateThread ? "private" : "public",
        direction: "outbound",
        author: agent,
        body: pick(AGENT_REPLIES, rng),
        createdAt: respondedAt,
        attachments: [],
        replyToId: null,
        aiConfidence: null,
      });

      if (conversation.lastMessageAt.getTime() - respondedAt.getTime() >= 8 * MINUTE_MS) {
        push({
          kind: privateThread ? "private" : "public",
          direction: "inbound",
          author: customerAuthor,
          body: `Thanks - following up on the ${INTENT_META[conversation.intent].toLowerCase()}.`,
          createdAt: conversation.lastMessageAt,
          attachments: [],
          replyToId: null,
          aiConfidence: null,
        });
      }
    }

    if (conversation.assignedTo && windowMin >= 6) {
      push({
        kind: "system",
        direction: "outbound",
        author: SYSTEM_AUTHOR,
        body: `Assigned to ${conversation.assignedTo.name}.`,
        createdAt: at(t0, 3),
        attachments: [],
        replyToId: null,
        aiConfidence: null,
      });
      audit.push(
        createAudit(conversation.id, "assigned", "Assigned", "System", at(t0, 3), {
          assigneeId: conversation.assignedTo.id,
        }),
      );
    }

    if (conversation.status === "escalated") {
      push({
        kind: "system",
        direction: "outbound",
        author: SYSTEM_AUTHOR,
        body: "Escalated to a supervisor for review.",
        createdAt: at(conversation.lastMessageAt, 1),
        attachments: [],
        replyToId: null,
        aiConfidence: null,
      });
      audit.push(
        createAudit(conversation.id, "escalated", "Escalated", "System", at(conversation.lastMessageAt, 1)),
      );
    }

    if (conversation.needsReview) {
      audit.push(
        createAudit(conversation.id, "status_changed", "Flagged for review", "System", conversation.lastMessageAt, {
          needsReview: true,
        }),
      );
    }

    return { messages: [...sortTimeline(messages)], audit: [...audit].sort(byAuditOrder) };
  }

  function byAuditOrder(a: AuditEvent, b: AuditEvent): number {
    const byTime = a.createdAt.getTime() - b.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  }

  function ensureThread(conversationId: string): ThreadState {
    const existing = threads.get(conversationId);
    if (existing) return existing;
    const conversation = inbox.getById(conversationId);
    if (!conversation) {
      const empty: ThreadState = { messages: [], audit: [] };
      threads.set(conversationId, empty);
      return empty;
    }
    const built = buildThread(conversation);
    threads.set(conversationId, built);
    return built;
  }

  function getConversation(id: string): InboxConversation | null {
    return inbox.getById(id);
  }

  function threadInfo(id: string): ConversationThreadInfo | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;
    const link = links.get(id);
    const hasPrivate = ensureThread(id).messages.some((message) => message.kind === "private");
    // A conversation created by a public-to-private move is itself a DM, even
    // before it carries a private message, so it can never be moved again.
    const isDirectMessage = link?.originConversationId != null;
    return {
      type: hasPrivate || isDirectMessage ? "private" : "public",
      originConversationId: link?.originConversationId ?? null,
      movedToConversationId: link?.movedToConversationId ?? null,
      assignees: inbox.assignees(),
    };
  }

  function listMessages(id: string): readonly ConversationMessage[] {
    return ensureThread(id).messages;
  }

  function listAudit(id: string): readonly AuditEvent[] {
    return [...ensureThread(id).audit].sort(byAuditOrder);
  }

  function customerHistory(customerId: string): CustomerHistory | null {
    const all = inbox.list({ ...DEFAULT_INBOX_QUERY, pageSize: 1000 }).items;
    const owned = all
      .filter((conversation) => conversation.customer.id === customerId)
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    const first = owned[0];
    if (!first) return null;

    const sortedByTime = [...owned].sort((a, b) => a.lastMessageAt.getTime() - b.lastMessageAt.getTime());
    const earliest = sortedByTime[0] ?? first;

    return {
      customer: first.customer,
      totalConversations: owned.length,
      openConversations: owned.filter(
        (conversation) => conversation.status === "open" || conversation.status === "pending" || conversation.status === "awaiting_customer" || conversation.status === "escalated",
      ).length,
      resolvedConversations: owned.filter(
        (conversation) => conversation.status === "resolved" || conversation.status === "closed",
      ).length,
      firstContactAt: earliest.lastMessageAt,
      lastContactAt: first.lastMessageAt,
      recent: owned.slice(0, 6).map((conversation) => ({
        id: conversation.id,
        channel: conversation.channel,
        intent: conversation.intent,
        status: conversation.status,
        priority: conversation.priority,
        preview: conversation.preview,
        lastMessageAt: conversation.lastMessageAt,
      })),
    };
  }

  function sendMessage(id: string, input: SendMessageInput, now: Date = new Date()): SendMessageResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;

    const requestId = input.clientRequestId?.trim() ?? "";
    if (requestId.length > 0) {
      const key = `${id}::${requestId}`;
      const existing = sentRequests.get(key);
      // A retry of the same send returns the original message: the agent never
      // gets two copies of one reply because they double-clicked (§42).
      if (existing) {
        return {
          message: existing,
          conversation: inbox.getById(id) ?? conversation,
          duplicate: true,
        };
      }
    }

    const state = ensureThread(id);
    const seq = state.messages.length;
    const message = makeMessage(id, seq, {
      kind: input.kind,
      direction: "outbound",
      author: input.author,
      body: input.body,
      createdAt: now,
      attachments: input.attachments,
      replyToId: input.replyToId ?? null,
      aiConfidence: null,
    });
    state.messages.push(message);
    const event = auditForMessage(message);
    if (event) state.audit.push(event);

    // Only customer-facing replies may change the conversation preview. An
    // internal note must never surface in the inbox as if it were a reply (§9).
    const isReply = input.kind === "public" || input.kind === "private";
    const updated =
      inbox.update(id, {
        lastMessageAt: now,
        preview: isReply && input.body.length > 0 ? input.body : conversation.preview,
        unread: false,
        respondedAt: isReply && conversation.respondedAt === null ? now : conversation.respondedAt,
        status: isReply ? "awaiting_customer" : conversation.status,
      }) ?? conversation;

    if (requestId.length > 0) {
      sentRequests.set(`${id}::${requestId}`, message);
    }

    return { message, conversation: updated, duplicate: false };
  }

  function recordOpen(id: string, input: OpenInput, now: Date = new Date()): OpenResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;

    const actors = openedBy.get(id) ?? new Set<string>();
    if (actors.has(input.actor)) {
      const existing = latestOpenEvent(id, input.actor);
      return existing === null ? null : { conversation, event: existing, firstOpen: false };
    }

    actors.add(input.actor);
    openedBy.set(id, actors);

    const event = createAudit(
      id,
      "opened",
      `${AUDIT_EVENT_META.opened.label} by ${input.actor}.`,
      input.actor,
      now,
      { status: conversation.status },
    );
    ensureThread(id).audit.push(event);

    return { conversation, event, firstOpen: true };
  }

  function latestOpenEvent(id: string, actor: string): AuditEvent | null {
    const events = ensureThread(id).audit.filter((event) => event.type === "opened" && event.actor === actor);
    return events.at(-1) ?? null;
  }

  function recordDraftEdit(id: string, input: DraftEditInput, now: Date = new Date()): DraftEditResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;

    const event = createAudit(
      id,
      "draft_edited",
      `${AUDIT_EVENT_META.draft_edited.label} (${input.action}, ${input.source}).`,
      input.actor,
      now,
      { action: input.action, source: input.source, characters: input.characters },
    );
    ensureThread(id).audit.push(event);

    return { conversation, event };
  }

  function recordAiSuggestion(id: string, input: AiSuggestionInput, now: Date = new Date()): AiSuggestionResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;

    const event = createAudit(
      id,
      "ai_suggested",
      `${AUDIT_EVENT_META.ai_suggested.label} (${input.action}). Draft only - not sent.`,
      input.actor,
      now,
      { action: input.action, suggestionId: input.suggestionId, sent: false },
    );
    ensureThread(id).audit.push(event);

    return { conversation, event };
  }

  function systemMessageFor(id: string, state: ThreadState, body: string, now: Date): ConversationMessage {
    const message = makeMessage(id, state.messages.length, {
      kind: "system",
      direction: "outbound",
      author: SYSTEM_AUTHOR,
      body,
      createdAt: now,
      attachments: [],
      replyToId: null,
      aiConfidence: null,
    });
    state.messages.push(message);
    return message;
  }

  function resolve(id: string, input: ResolveInput, now: Date = new Date()): StatusChangeResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;
    if (conversation.status === "resolved") return null;

    const updated = inbox.update(id, { status: "resolved", needsReview: false, unread: false });
    if (!updated) return null;

    const state = ensureThread(id);
    const systemMessage = systemMessageFor(id, state, summariseResolution(input.note), now);
    const event = createAudit(id, "resolved", summariseResolution(input.note), input.actor, now, {
      previousStatus: conversation.status,
    });
    state.audit.push(event);

    return { conversation: updated, event, systemMessage };
  }

  function setStatus(id: string, input: StatusChangeInput, now: Date = new Date()): StatusChangeResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;
    if (conversation.status === input.status) return null;

    const updated = inbox.update(id, {
      status: input.status,
      // Reopening puts the conversation back in the queue rather than leaving it
      // silently resolved.
      needsReview: input.status === "open" ? true : conversation.needsReview,
    });
    if (!updated) return null;

    const state = ensureThread(id);
    const reopened = conversation.status === "resolved" || conversation.status === "closed";
    const summary = reopened
      ? summariseReopen(input.reason)
      : `Status changed to ${input.status}.`;

    const systemMessage = systemMessageFor(id, state, summary, now);
    const event = createAudit(id, "status_changed", summary, input.actor, now, {
      status: input.status,
      previousStatus: conversation.status,
    });
    state.audit.push(event);

    return { conversation: updated, event, systemMessage };
  }

  function changePriority(
    id: string,
    input: PriorityChangeInput,
    now: Date = new Date(),
  ): PriorityChangeResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;
    if (conversation.priority === input.priority) return null;

    const previous = conversation.priority;
    const updated = inbox.update(id, { priority: input.priority });
    if (!updated) return null;

    const state = ensureThread(id);
    const reason = input.reason.trim();
    const summary = `Priority changed from ${PRIORITY_META[previous].label} to ${
      PRIORITY_META[input.priority].label
    }.${reason.length > 0 ? ` ${reason}` : ""}`;

    const event = createAudit(id, "priority_changed", summary, input.actor, now, {
      previousPriority: previous,
      priority: input.priority,
      reason: reason.length > 0 ? reason : null,
    });
    state.audit.push(event);

    return { conversation: updated, event };
  }

  function clearEscalation(
    id: string,
    input: ClearEscalationInput,
    now: Date = new Date(),
  ): SupervisorActionResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;
    if (conversation.status !== "escalated") return null;

    const updated = inbox.update(id, { status: "open" });
    if (!updated) return null;

    const note = input.note.trim();
    const summary = `${escalationOutcomeSummary(input.outcome)}${note.length > 0 ? ` ${note}` : ""}`;

    const event = createAudit(id, "escalation_resolved", summary, input.actor, now, {
      outcome: input.outcome,
      previousStatus: conversation.status,
      note: note.length > 0 ? note : null,
    });
    ensureThread(id).audit.push(event);

    return { conversation: updated, event };
  }

  function clearQaReview(
    id: string,
    input: ClearQaReviewInput,
    now: Date = new Date(),
  ): SupervisorActionResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;
    if (!conversation.needsReview) return null;

    // A request for changes keeps the item on the board: the agent still owes a
    // revision, so the flag stays until the conversation is approved.
    const updated = inbox.update(id, { needsReview: input.outcome !== "approved" });
    if (!updated) return null;

    const note = input.note.trim();
    const summary = input.outcome === "approved" ? "QA review approved." : "QA review: changes requested.";
    const event = createAudit(id, "qa_reviewed", note.length > 0 ? `${summary} ${note}` : summary, input.actor, now, {
      outcome: input.outcome,
      note: note.length > 0 ? note : null,
    });
    ensureThread(id).audit.push(event);

    return { conversation: updated, event };
  }

  function assign(id: string, input: AssignInput, now: Date = new Date()): AssignResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;

    const previous = conversation.assignedTo;
    const assignee = input.assigneeId
      ? inbox.assignees().find((agent) => agent.id === input.assigneeId) ?? null
      : null;

    const updated = inbox.update(id, { assignedTo: assignee });
    if (!updated) return null;

    const state = ensureThread(id);
    const summary = assignee ? `Assigned to ${assignee.name}.` : "Conversation unassigned.";
    const message = makeMessage(id, state.messages.length, {
      kind: "system",
      direction: "outbound",
      author: SYSTEM_AUTHOR,
      body: summary,
      createdAt: now,
      attachments: [],
      replyToId: null,
      aiConfidence: null,
    });
    state.messages.push(message);

    const type: AuditEventType = assignee === null ? "unassigned" : previous ? "reassigned" : "assigned";
    const event = createAudit(id, type, AUDIT_EVENT_META[type].label, input.actor, now, {
      assigneeId: assignee?.id ?? null,
      previousAssigneeId: previous?.id ?? null,
    });
    state.audit.push(event);

    return { conversation: updated, event };
  }

  function escalate(id: string, input: EscalateInput, now: Date = new Date()): EscalateResult | null {
    const conversation = inbox.getById(id);
    if (!conversation) return null;

    const updated = inbox.update(id, { status: "escalated", needsReview: true });
    if (!updated) return null;

    const state = ensureThread(id);
    const systemMessage = makeMessage(id, state.messages.length, {
      kind: "system",
      direction: "outbound",
      author: SYSTEM_AUTHOR,
      body: summariseEscalation(input.reason),
      createdAt: now,
      attachments: [],
      replyToId: null,
      aiConfidence: null,
    });
    state.messages.push(systemMessage);

    if (input.note.trim().length > 0) {
      const note = makeMessage(id, state.messages.length, {
        kind: "internal_note",
        direction: "outbound",
        author: input.author,
        body: input.note.trim(),
        createdAt: new Date(now.getTime() + 1_000),
        attachments: [],
        replyToId: null,
        aiConfidence: null,
      });
      state.messages.push(note);
      const noteEvent = auditForMessage(note);
      if (noteEvent) state.audit.push(noteEvent);
    }

    const event = createAudit(id, "escalated", AUDIT_EVENT_META.escalated.label, input.actor, now, {
      reason: input.reason,
    });
    state.audit.push(event);

    return { conversation: updated, message: systemMessage, event };
  }

  function moveToPrivate(
    id: string,
    input: MoveToPrivateInput,
    now: Date = new Date(),
  ): MoveToPrivateResult | null {
    const origin = inbox.getById(id);
    if (!origin) return null;

    const existingLink = links.get(id);
    if (existingLink?.movedToConversationId) {
      const existing = inbox.getById(existingLink.movedToConversationId);
      if (existing) {
        return {
          origin,
          created: existing,
          event: createAudit(id, "moved_to_private", AUDIT_EVENT_META.moved_to_private.label, input.actor, now),
        };
      }
    }

    dmCounter += 1;
    const createdId = `cv_dm_${String(dmCounter).padStart(4, "0")}`;
    const greeting = input.greeting.trim();

    const created = inbox.create({
      id: createdId,
      interactionId: `INT-SOC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-DM${String(dmCounter).padStart(5, "0")}`,
      channel: origin.channel,
      customer: origin.customer,
      receivedAt: now,
      lastMessageAt: now,
      respondedAt: null,
      preview: greeting.length > 0 ? greeting : `Direct message requested: ${input.reason}`,
      intent: origin.intent,
      sentiment: origin.sentiment,
      priority: origin.priority,
      status: "open",
      slaPaused: false,
      needsReview: false,
      assignedTo: origin.assignedTo,
      unread: true,
    });

    links.set(id, {
      originConversationId: links.get(id)?.originConversationId ?? null,
      movedToConversationId: createdId,
    });
    links.set(createdId, {
      originConversationId: id,
      movedToConversationId: null,
    });

    const createdMessages: ConversationMessage[] = [];
    const createdAudit: AuditEvent[] = [];

    const systemMessage = makeMessage(createdId, 0, {
      kind: "system",
      direction: "outbound",
      author: SYSTEM_AUTHOR,
      body: `Moved from public conversation ${id} (${input.reason}). The original interaction is preserved.`,
      createdAt: now,
      attachments: [],
      replyToId: null,
      aiConfidence: null,
    });
    createdMessages.push(systemMessage);
    createdAudit.push(
      createAudit(createdId, "moved_to_private", AUDIT_EVENT_META.moved_to_private.label, input.actor, now, {
        originConversationId: id,
        reason: input.reason,
      }),
    );

    if (greeting.length > 0) {
      const privateMessage = makeMessage(createdId, 1, {
        kind: "private",
        direction: "outbound",
        author: input.author,
        body: greeting,
        createdAt: new Date(now.getTime() + 1_000),
        attachments: [],
        replyToId: null,
        aiConfidence: null,
      });
      createdMessages.push(privateMessage);
      const event = auditForMessage(privateMessage);
      if (event) createdAudit.push(event);
    }

    threads.set(createdId, { messages: createdMessages, audit: createdAudit });

    const originState = ensureThread(id);
    const originSystem = makeMessage(id, originState.messages.length, {
      kind: "system",
      direction: "outbound",
      author: SYSTEM_AUTHOR,
      body: `Moved to a direct message (${createdId}). Original public interaction preserved.`,
      createdAt: now,
      attachments: [],
      replyToId: null,
      aiConfidence: null,
    });
    originState.messages.push(originSystem);
    inbox.update(id, { lastMessageAt: now, needsReview: false });

    const event = createAudit(id, "moved_to_private", AUDIT_EVENT_META.moved_to_private.label, input.actor, now, {
      movedToConversationId: createdId,
      reason: input.reason,
    });
    originState.audit.push(event);

    return { origin, created, event };
  }

  function reset(now: Date = new Date()): void {
    threads.clear();
    links.clear();
    sentRequests.clear();
    openedBy.clear();
    dmCounter = 0;
    eventSeq = 0;
    // Replies and assignments mutate the shared inbox, so rebuild it from the
    // seed too; otherwise the next thread would be built from mutated state.
    inbox = resetDemoInboxStore(now);
  }

  return {
    getConversation,
    threadInfo,
    listMessages,
    listAudit,
    customerHistory,
    sendMessage,
    assign,
    escalate,
    moveToPrivate,
    recordOpen,
    recordDraftEdit,
    recordAiSuggestion,
    resolve,
    setStatus,
    changePriority,
    clearEscalation,
    clearQaReview,
    reset,
  };
}

/* -------------------------------------------------------------------------
 * Process-wide singleton
 * ---------------------------------------------------------------------- */

let activeStore: ConversationStore = buildConversationStore();

export function demoConversationStore(): ConversationStore {
  return activeStore;
}

export function resetDemoConversationStore(now: Date = new Date()): ConversationStore {
  // Resetting the inbox rebuilds the underlying conversation dataset too.
  resetDemoInboxStore(now);
  activeStore = buildConversationStore();
  return activeStore;
}
