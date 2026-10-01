import type { ConversationThreadInfo } from "@/lib/domain/conversation";
import type { ConversationStatus } from "@/lib/domain/taxonomy";
import { can } from "@/server/rbac/permissions";
import type { Role } from "@/lib/domain/user";

/**
 * Conversation authorization policy.
 *
 * Enforced on the server for every conversation mutation. The UI mirrors these
 * checks cosmetically, but this module is the boundary that actually denies
 * access, so it is the thing tests exercise (§29).
 */

export function canViewConversation(role: Role | null): boolean {
  return can(role, "conversation.read");
}

export function canReplyToConversation(role: Role | null): boolean {
  return can(role, "conversation.reply");
}

export function canEscalateConversation(role: Role | null): boolean {
  return can(role, "conversation.escalate");
}

/** Resolving closes a conversation, so it needs its own permission. */
export function canResolveConversation(role: Role | null): boolean {
  return can(role, "conversation.resolve");
}

/**
 * AI assistance is drafting only. It is gated separately from replying so a role
 * that may write to a customer can still be denied generated copy - and because
 * the assistant can never send, `ai.assist` alone grants no write path (§8).
 */
export function canUseAiAssist(role: Role | null): boolean {
  return can(role, "ai.assist");
}

export function canUseAiAssistOn(
  role: Role | null,
  thread: Pick<ConversationThreadInfo, "type">,
): boolean {
  if (!canUseAiAssist(role)) return false;
  // Internal notes exist only on public threads; refusing keeps the helper from
  // inventing copy for a surface the customer never sees.
  return thread.type === "public";
}

/**
 * Resolving is only meaningful on a conversation that is still live. A resolved
 * conversation is reopened instead, so the two paths never collide.
 */
export function canResolveStatus(role: Role | null, currentStatus: ConversationStatus): boolean {
  return canResolveConversation(role) && currentStatus !== "resolved" && currentStatus !== "closed";
}

/** Only a public conversation can be moved into a direct message. */
export function canMoveToPrivate(
  role: Role | null,
  thread: Pick<ConversationThreadInfo, "type" | "movedToConversationId">,
): boolean {
  if (!canReplyToConversation(role)) return false;
  if (thread.movedToConversationId !== null) return false;
  return thread.type === "public";
}

export interface AssignDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Assignment rules:
 *  - agents may claim unassigned conversations and change their own assignment;
 *  - reassigning a conversation that belongs to someone else needs supervision.
 */
export function canAssignConversation(
  role: Role | null,
  input: { currentAssigneeId: string | null; actorId: string },
): AssignDecision {
  const mayTransfer = can(role, "conversation.transfer") || can(role, "supervisor.team.view");
  if (!mayTransfer) {
    return { allowed: false, reason: "Your role cannot assign conversations." };
  }

  if (input.currentAssigneeId === null || input.currentAssigneeId === input.actorId) {
    return { allowed: true };
  }

  if (can(role, "supervisor.team.view")) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Only a supervisor can reassign a conversation owned by another agent.",
  };
}
