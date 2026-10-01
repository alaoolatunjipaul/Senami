import type { ChannelId } from "@/lib/config";
import type { InboxAssignee, InboxConversationDto, InboxCustomer } from "@/lib/domain/inbox";
import {
  MESSAGE_KIND_META,
  type ConversationStatus,
  type Intent,
  type MessageKind,
  type Priority,
  type Tone,
} from "@/lib/domain/taxonomy";
import type { Role } from "@/lib/domain/user";

/**
 * Conversation workspace domain.
 *
 * The public/private distinction is the defining rule of Senami (spec §3): every
 * message carries a kind, that kind is rendered on the message itself, and only
 * customer-facing kinds may ever reach a customer. This module holds the pure
 * vocabulary and rules the store, the API and the UI all share, so the rule can
 * be unit tested without a database, a clock or a browser.
 */

/* -------------------------------------------------------------------------
 * Messages
 * ---------------------------------------------------------------------- */

export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_AUTHOR_TYPES = ["customer", "agent", "ai", "system"] as const;
export type MessageAuthorType = (typeof MESSAGE_AUTHOR_TYPES)[number];

export interface MessageAuthor {
  readonly id: string;
  readonly name: string;
  readonly type: MessageAuthorType;
  /** Present for agents. */
  readonly role?: Role;
  readonly teamName?: string;
}

export const ATTACHMENT_KINDS = ["image", "document", "video", "audio", "other"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export interface MessageAttachment {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** Mock asset path. Real social uploads are intentionally not wired yet. */
  readonly url: string;
  readonly kind: AttachmentKind;
}

/** Mock attachment vocabulary used by the composer and the seeded threads. */
export const MOCK_ATTACHMENTS: readonly Omit<MessageAttachment, "id">[] = [
  { name: "card-declined.png", mimeType: "image/png", sizeBytes: 184_320, url: "/demo/attachments/card-declined.png", kind: "image" },
  { name: "transaction-screenshot.jpg", mimeType: "image/jpeg", sizeBytes: 421_888, url: "/demo/attachments/transaction-screenshot.jpg", kind: "image" },
  { name: "statement.pdf", mimeType: "application/pdf", sizeBytes: 1_048_576, url: "/demo/attachments/statement.pdf", kind: "document" },
  { name: "id-verification.pdf", mimeType: "application/pdf", sizeBytes: 786_432, url: "/demo/attachments/id-verification.pdf", kind: "document" },
] as const;

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly kind: MessageKind;
  readonly direction: MessageDirection;
  readonly author: MessageAuthor;
  readonly body: string;
  readonly createdAt: Date;
  readonly attachments: readonly MessageAttachment[];
  /**
   * For a private thread that continues a public interaction, the id of the
   * public message that prompted it. The public interaction is preserved.
   */
  readonly replyToId?: string | null;
  /** AI messages only: model confidence, 0-1. */
  readonly aiConfidence?: number | null;
}

export interface ConversationMessageDto {
  readonly id: string;
  readonly conversationId: string;
  readonly kind: MessageKind;
  readonly direction: MessageDirection;
  readonly author: MessageAuthor;
  readonly body: string;
  readonly createdAt: string;
  readonly attachments: readonly MessageAttachment[];
  readonly replyToId: string | null;
  readonly aiConfidence: number | null;
}

export function toConversationMessageDto(message: ConversationMessage): ConversationMessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    kind: message.kind,
    direction: message.direction,
    author: message.author,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    attachments: message.attachments,
    replyToId: message.replyToId ?? null,
    aiConfidence: message.aiConfidence ?? null,
  };
}

/* -------------------------------------------------------------------------
 * Message rules
 * ---------------------------------------------------------------------- */

/** Kinds a customer may ever see. Internal notes and system events never are. */
export function isCustomerFacing(kind: MessageKind): boolean {
  return kind === "public" || kind === "private";
}

/** Internal notes must never be sent as customer-facing messages. */
export function isInternalMessage(kind: MessageKind): boolean {
  return kind === "internal_note";
}

export function isSystemMessage(kind: MessageKind): boolean {
  return kind === "system";
}

export function isAiMessage(kind: MessageKind): boolean {
  return kind === "ai_generated";
}

export function messageKindLabel(kind: MessageKind): string {
  return MESSAGE_KIND_META[kind].label;
}

export function sortTimeline(
  messages: readonly ConversationMessage[],
): readonly ConversationMessage[] {
  return [...messages].sort((a, b) => {
    const byTime = a.createdAt.getTime() - b.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });
}

/* -------------------------------------------------------------------------
 * Body validation (shared by the composer and the API)
 * ---------------------------------------------------------------------- */

export const MESSAGE_BODY_MIN = 1;
export const MESSAGE_BODY_MAX = 2000;

export interface MessageValidation {
  readonly valid: boolean;
  readonly message?: string;
}

export function validateMessageBody(body: string): MessageValidation {
  const trimmed = body.trim();
  if (trimmed.length < MESSAGE_BODY_MIN) {
    return { valid: false, message: "Write a message before sending." };
  }
  if (trimmed.length > MESSAGE_BODY_MAX) {
    return { valid: false, message: `Messages are limited to ${MESSAGE_BODY_MAX} characters.` };
  }
  return { valid: true };
}

/* -------------------------------------------------------------------------
 * Attachments
 * ---------------------------------------------------------------------- */

export function attachmentKindOf(mimeType: string): AttachmentKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation")
  ) {
    return "document";
  }
  return "other";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* -------------------------------------------------------------------------
 * Composer
 * ---------------------------------------------------------------------- */

export const COMPOSER_MODES = ["public", "private", "internal_note"] as const;
export type ComposerMode = (typeof COMPOSER_MODES)[number];

export type ComposerMessageKind = Extract<MessageKind, "public" | "private" | "internal_note">;

export const COMPOSER_MODE_TO_KIND: Record<ComposerMode, ComposerMessageKind> = {
  public: "public",
  private: "private",
  internal_note: "internal_note",
};

export interface ComposerModeMeta {
  readonly label: string;
  readonly description: string;
  readonly tone: Tone;
  /** Warn before sending because the content becomes customer-visible. */
  readonly customerFacing: boolean;
}

export const COMPOSER_MODE_META: Record<ComposerMode, ComposerModeMeta> = {
  public: {
    label: "Public Reply",
    description: "Visible publicly on the social platform.",
    tone: "public",
    customerFacing: true,
  },
  private: {
    label: "Private Reply",
    description: "Sent to the customer as a direct message.",
    tone: "private",
    customerFacing: true,
  },
  internal_note: {
    label: "Internal Note",
    description: "Internal only. Never sent to the customer.",
    tone: "internal",
    customerFacing: false,
  },
};

export function composerModeForKind(kind: MessageKind): ComposerMode | null {
  if (kind === "public") return "public";
  if (kind === "private") return "private";
  if (kind === "internal_note") return "internal_note";
  return null;
}

export interface MessageDraft {
  readonly mode: ComposerMode;
  readonly body: string;
  readonly attachments: readonly MessageAttachment[];
}

export function emptyDraft(mode: ComposerMode = "public"): MessageDraft {
  return { mode, body: "", attachments: [] };
}

export function draftHasContent(draft: MessageDraft): boolean {
  return draft.body.trim().length > 0 || draft.attachments.length > 0;
}

/* -------------------------------------------------------------------------
 * Audit trail
 * ---------------------------------------------------------------------- */

export const AUDIT_EVENT_TYPES = [
  "conversation_created",
  "message_public",
  "message_private",
  "note_added",
  "ai_suggested",
  "assigned",
  "reassigned",
  "unassigned",
  "escalated",
  "status_changed",
  "moved_to_private",
  "read",
  "sla_paused",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AUDIT_EVENT_META: Record<AuditEventType, { label: string; tone: Tone }> = {
  conversation_created: { label: "Conversation created", tone: "neutral" },
  message_public: { label: "Public reply", tone: "public" },
  message_private: { label: "Private reply", tone: "private" },
  note_added: { label: "Internal note added", tone: "internal" },
  ai_suggested: { label: "AI suggestion generated", tone: "ai" },
  assigned: { label: "Assigned", tone: "info" },
  reassigned: { label: "Reassigned", tone: "info" },
  unassigned: { label: "Unassigned", tone: "neutral" },
  escalated: { label: "Escalated", tone: "critical" },
  status_changed: { label: "Status changed", tone: "neutral" },
  moved_to_private: { label: "Moved to direct message", tone: "private" },
  read: { label: "Marked read", tone: "neutral" },
  sla_paused: { label: "SLA paused", tone: "warning" },
};

export interface AuditEvent {
  readonly id: string;
  readonly conversationId: string;
  readonly type: AuditEventType;
  readonly summary: string;
  readonly actor: string;
  readonly createdAt: Date;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AuditEventDto {
  readonly id: string;
  readonly conversationId: string;
  readonly type: AuditEventType;
  readonly summary: string;
  readonly actor: string;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export function toAuditEventDto(event: AuditEvent): AuditEventDto {
  return {
    id: event.id,
    conversationId: event.conversationId,
    type: event.type,
    summary: event.summary,
    actor: event.actor,
    createdAt: event.createdAt.toISOString(),
    metadata: event.metadata,
  };
}

/* -------------------------------------------------------------------------
 * Customer & conversation history
 * ---------------------------------------------------------------------- */

export interface CustomerHistoryConversation {
  readonly id: string;
  readonly channel: ChannelId;
  readonly intent: Intent;
  readonly status: ConversationStatus;
  readonly priority: Priority;
  readonly preview: string;
  readonly lastMessageAt: Date;
}

export interface CustomerHistory {
  readonly customer: InboxCustomer;
  readonly totalConversations: number;
  readonly openConversations: number;
  readonly resolvedConversations: number;
  readonly firstContactAt: Date;
  readonly lastContactAt: Date;
  readonly recent: readonly CustomerHistoryConversation[];
}

export interface CustomerHistoryDto {
  readonly customer: InboxCustomer;
  readonly totalConversations: number;
  readonly openConversations: number;
  readonly resolvedConversations: number;
  readonly firstContactAt: string;
  readonly lastContactAt: string;
  readonly recent: ReadonlyArray<Omit<CustomerHistoryConversation, "lastMessageAt"> & { readonly lastMessageAt: string }>;
}

export function toCustomerHistoryDto(history: CustomerHistory): CustomerHistoryDto {
  return {
    customer: history.customer,
    totalConversations: history.totalConversations,
    openConversations: history.openConversations,
    resolvedConversations: history.resolvedConversations,
    firstContactAt: history.firstContactAt.toISOString(),
    lastContactAt: history.lastContactAt.toISOString(),
    recent: history.recent.map((entry) => ({
      ...entry,
      lastMessageAt: entry.lastMessageAt.toISOString(),
    })),
  };
}

/* -------------------------------------------------------------------------
 * Escalation
 * ---------------------------------------------------------------------- */

export const ESCALATION_REASONS = [
  "sla_breach",
  "complex_case",
  "fraud_risk",
  "customer_request",
  "policy",
  "other",
] as const;

export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const ESCALATION_REASON_LABELS: Record<EscalationReason, string> = {
  sla_breach: "SLA breach",
  complex_case: "Complex case",
  fraud_risk: "Fraud or security risk",
  customer_request: "Customer requested",
  policy: "Policy or compliance",
  other: "Other",
};

export interface EscalationRequest {
  readonly reason: EscalationReason;
  readonly note: string;
}

export const ESCALATION_NOTE_MAX = 1000;

export function summariseEscalation(reason: EscalationReason): string {
  return `Escalated to supervisor: ${ESCALATION_REASON_LABELS[reason]}.`;
}

/* -------------------------------------------------------------------------
 * Public-to-private workflow
 * ---------------------------------------------------------------------- */

/**
 * Shown verbatim before an agent moves a public interaction into a direct
 * message. The wording is deliberate: the public conversation is preserved and
 * the customer will see a new private thread.
 */
export const MOVE_TO_PRIVATE_WARNING =
  "This will open a private direct message with the customer and continue the conversation there. The original public interaction is kept for the audit trail and is never deleted.";

export interface MoveToPrivateRequest {
  readonly reason: string;
  /** Optional first private message sent to the customer when moving. */
  readonly greeting: string;
}

/* -------------------------------------------------------------------------
 * Thread metadata exposed by the detail endpoint
 * ---------------------------------------------------------------------- */

export interface ConversationThreadInfo {
  readonly type: "public" | "private";
  readonly originConversationId: string | null;
  readonly movedToConversationId: string | null;
  readonly assignees: readonly InboxAssignee[];
}

export interface ConversationDetailResponse {
  readonly conversation: InboxConversationDto;
  readonly thread: ConversationThreadInfo;
}

export interface ConversationMessagesResponse {
  readonly messages: readonly ConversationMessageDto[];
}

export interface ConversationAuditResponse {
  readonly events: readonly AuditEventDto[];
}
