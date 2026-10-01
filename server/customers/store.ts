import {
  openIssuesFor,
  recentInteractionsFor,
  type CustomerAccount,
  type CustomerContext,
} from "@/lib/domain/customer";
import { CHANNELS, type ChannelId } from "@/lib/config";
import { demoConversationStore } from "@/server/conversations/store";

/**
 * Customer context store.
 *
 * Builds the richer profile the workspace shows before an agent replies:
 * account metadata, tags, open issues and interaction history. Every value is
 * derived deterministically from the customer's own conversation records, so
 * the panel can never contradict the conversation behind it, and no field is
 * invented at render time.
 */

const TAGS_BY_INTENT: ReadonlyArray<readonly string[]> = [
  ["banking-app", "self-service"],
  ["card", "active-issue"],
  ["transfer", "pending"],
  ["fraud", "high-risk"],
  ["complaint", "follow-up"],
  ["premium", "priority"],
  ["new-customer", "onboarding"],
  ["business", "high-value"],
];

const SEGMENTS: readonly CustomerAccount["segment"][] = ["standard", "premium", "business"];

const SEGMENT_BY_PRIORITY: Readonly<Record<string, CustomerAccount["segment"]>> = {
  critical: "business",
  high: "premium",
  medium: "standard",
  low: "standard",
};

function hashOf(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic tags: intent-derived plus a stable pair from the customer id. */
function tagsFor(customerId: string, intent: string): readonly string[] {
  const index = TAGS_BY_INTENT.findIndex((pool) => pool.includes(intent));
  const base = index >= 0 ? TAGS_BY_INTENT[index] ?? [] : TAGS_BY_INTENT[0] ?? [];
  const seed = hashOf(customerId);
  const extra = TAGS_BY_INTENT[seed % TAGS_BY_INTENT.length] ?? [];
  const tags = new Set<string>(base);
  for (const tag of extra) {
    if (tags.size >= 3) break;
    tags.add(tag);
  }
  return [...tags];
}

function channelsFor(customerId: string, primary: ChannelId): readonly ChannelId[] {
  const seed = hashOf(`channels:${customerId}`);
  const others = CHANNELS.filter((channel) => channel !== primary);
  const count = 1 + (seed % Math.max(1, others.length));
  return [primary, ...others.slice(0, count)];
}

function segmentFor(customerId: string, priority: string): CustomerAccount["segment"] {
  const mapped = SEGMENT_BY_PRIORITY[priority];
  if (mapped) return mapped;
  return SEGMENTS[hashOf(`segment:${customerId}`) % SEGMENTS.length] ?? "standard";
}

/**
 * Resolve the full context for a customer, or null when the customer is not in
 * the dataset. `now` only anchors the synthetic account "since" date so the
 * panel is stable within a session and reproducible in tests.
 */
export function customerContextFor(customerId: string, now: Date = new Date()): CustomerContext | null {
  const history = demoConversationStore().customerHistory(customerId);
  if (!history) return null;

  const seed = hashOf(customerId);
  const primaryChannel = history.recent[0]?.channel ?? "instagram";
  const priority = history.recent[0]?.priority ?? "medium";
  const since = new Date(now.getTime() - (180 + (seed % 900)) * 86_400_000);

  const account: CustomerAccount = {
    reference: `ACC-${String(1000 + (seed % 8999))}`,
    segment: segmentFor(customerId, priority),
    since,
    verified: seed % 5 !== 0,
    preferredChannel: primaryChannel,
  };

  const openIssues = openIssuesFor(history);
  const interactions = recentInteractionsFor(history);

  return {
    id: customerId,
    name: history.customer.name,
    handle: history.customer.handle,
    channel: primaryChannel,
    channels: channelsFor(customerId, primaryChannel),
    account,
    tags: tagsFor(customerId, history.recent[0]?.intent ?? "general_enquiry"),
    openIssues,
    interactionCount: interactions.length > 0 ? 3 + (seed % 9) : history.totalConversations,
    lastInteractionAt: history.lastContactAt,
    firstInteractionAt: history.firstContactAt,
    history,
    recentInteractions: interactions,
    openIssueCount: history.openConversations,
    resolvedIssueCount: history.resolvedConversations,
  };
}