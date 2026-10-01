import type { ChannelId } from "@/lib/config";
import type {
  CustomerHistory,
  CustomerHistoryConversation,
  CustomerHistoryDto,
} from "@/lib/domain/conversation";
import { toCustomerHistoryDto } from "@/lib/domain/conversation";
import type { Tone } from "@/lib/domain/taxonomy";

/**
 * Customer context (§8).
 *
 * Everything an agent needs before replying: who the customer is, what they have
 * contacted us about before, what is still open on their account, and the
 * account metadata that changes how a reply should read. Every field is derived
 * from the deterministic demo dataset; there is no real customer data and no
 * external lookup (spec §47).
 */

export const CUSTOMER_INTERACTION_KINDS = ["message", "note", "call", "email"] as const;
export type CustomerInteractionKind = (typeof CUSTOMER_INTERACTION_KINDS)[number];

export interface CustomerInteraction {
  readonly id: string;
  readonly kind: CustomerInteractionKind;
  readonly summary: string;
  readonly occurredAt: Date;
  readonly conversationId: string | null;
}

export interface CustomerIssue {
  readonly id: string;
  readonly label: string;
  /** Who is currently responsible for moving it forward. */
  readonly owner: "customer" | "agent" | "team";
  readonly openedAt: Date;
  readonly conversationId: string | null;
}

export interface CustomerAccount {
  /** Synthetic account reference. Never a real customer identifier. */
  readonly reference: string;
  readonly segment: "standard" | "premium" | "business";
  readonly since: Date;
  readonly verified: boolean;
  readonly preferredChannel: ChannelId;
}

export interface CustomerContext {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly channel: ChannelId;
  readonly channels: readonly ChannelId[];
  readonly account: CustomerAccount;
  readonly tags: readonly string[];
  readonly openIssues: readonly CustomerIssue[];
  readonly interactionCount: number;
  readonly lastInteractionAt: Date;
  readonly firstInteractionAt: Date;
  readonly history: CustomerHistory;
  readonly recentInteractions: readonly CustomerInteraction[];
  readonly openIssueCount: number;
  readonly resolvedIssueCount: number;
}

/**
 * Interactions an agent may open for a customer. Deterministic: the set is
 * derived from the customer's own conversation ids, never invented per render.
 */
export function recentInteractionsFor(
  history: CustomerHistory,
): readonly CustomerInteraction[] {
  return history.recent.slice(0, 5).map((entry: CustomerHistoryConversation) => ({
    id: `ix_${entry.id}`,
    kind: entry.status === "resolved" || entry.status === "closed" ? "call" : "message",
    summary: entry.preview,
    occurredAt: entry.lastMessageAt,
    conversationId: entry.id,
  }));
}

/** Issues still open across the customer's conversations. */
export function openIssuesFor(history: CustomerHistory): readonly CustomerIssue[] {
  return history.recent
    .filter((entry: CustomerHistoryConversation) => entry.status !== "resolved" && entry.status !== "closed")
    .map((entry: CustomerHistoryConversation, index: number) => ({
      id: `issue_${entry.id}`,
      label: entry.preview,
      owner: entry.status === "awaiting_customer" ? "customer" : "agent",
      openedAt: new Date(entry.lastMessageAt.getTime() - (index + 1) * 86_400_000),
      conversationId: entry.id,
    }));
}

export const CUSTOMER_ISSUE_OWNER_LABELS: Record<CustomerIssue["owner"], string> = {
  customer: "Waiting on customer",
  agent: "With support",
  team: "With another team",
};

export const CUSTOMER_INTERACTION_KIND_LABELS: Record<CustomerInteractionKind, string> = {
  message: "Message",
  note: "Note",
  call: "Call",
  email: "Email",
};

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerAccount["segment"], string> = {
  standard: "Standard",
  premium: "Premium",
  business: "Business",
};

export const CUSTOMER_SEGMENT_TONES: Record<CustomerAccount["segment"], Tone> = {
  standard: "neutral",
  premium: "info",
  business: "primary",
};

/** A short, honest one-line summary shown at the top of the panel. */
export function customerContextSummary(context: {
  readonly interactionCount: number;
  readonly openIssueCount: number;
  readonly account: Pick<CustomerAccount, "segment">;
}): string {
  const issues = context.openIssueCount === 1 ? "1 open issue" : `${context.openIssueCount} open issues`;
  return `${context.interactionCount} interactions · ${issues} · ${context.account.segment} segment`;
}

export interface CustomerAccountDto extends Omit<CustomerAccount, "since"> {
  readonly since: string;
}

export interface CustomerIssueDto extends Omit<CustomerIssue, "openedAt"> {
  readonly openedAt: string;
}

export interface CustomerInteractionDto extends Omit<CustomerInteraction, "occurredAt"> {
  readonly occurredAt: string;
}

export interface CustomerContextDto {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly channel: ChannelId;
  readonly channels: readonly ChannelId[];
  readonly account: CustomerAccountDto;
  readonly tags: readonly string[];
  readonly openIssues: readonly CustomerIssueDto[];
  readonly interactionCount: number;
  readonly lastInteractionAt: string;
  readonly firstInteractionAt: string;
  readonly history: CustomerHistoryDto;
  readonly recentInteractions: readonly CustomerInteractionDto[];
  readonly openIssueCount: number;
  readonly resolvedIssueCount: number;
}

/** Serialise for the client; the panel never sees a raw Date. */
export function toCustomerContextDto(context: CustomerContext): CustomerContextDto {
  return {
    id: context.id,
    name: context.name,
    handle: context.handle,
    channel: context.channel,
    channels: context.channels,
    account: { ...context.account, since: context.account.since.toISOString() },
    tags: context.tags,
    openIssues: context.openIssues.map((issue) => ({ ...issue, openedAt: issue.openedAt.toISOString() })),
    interactionCount: context.interactionCount,
    lastInteractionAt: context.lastInteractionAt.toISOString(),
    firstInteractionAt: context.firstInteractionAt.toISOString(),
    history: toCustomerHistoryDto(context.history),
    recentInteractions: context.recentInteractions.map((entry) => ({
      ...entry,
      occurredAt: entry.occurredAt.toISOString(),
    })),
    openIssueCount: context.openIssueCount,
    resolvedIssueCount: context.resolvedIssueCount,
  };
}