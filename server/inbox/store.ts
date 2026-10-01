import { CHANNELS, CHANNEL_LABELS } from "@/lib/config";
import { MINUTE_MS } from "@/lib/format";
import type { SearchResultGroup } from "@/lib/domain/search";
import {
  DEFAULT_PAGE_SIZE,
  compareByRecency,
  conversationContainsText,
  matchesInboxQuery,
  type InboxAssignee,
  type InboxConversation,
  type InboxCustomer,
  type InboxFilterOptions,
  type InboxQuery,
} from "@/lib/domain/inbox";
import {
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
 * Inbox store.
 *
 * Phase 6 runs against a deterministic in-memory dataset so the whole inbox is
 * fully functional without DATABASE_URL (the PostgreSQL plan in
 * `docs/DATABASE-PLAN.md` is untouched). The store's shape is the repository
 * interface a Prisma implementation will satisfy later: list with filters,
 * lookup, mark read, search and aggregate options.
 *
 * The dataset is generated from a fixed seed and a fixed set of relative
 * offsets, so two boots produce the same ids, names, handles, categories and
 * ordering; only the absolute timestamps move with the boot time, which keeps
 * "Today" and "Last 7 days" meaningful in the demo.
 */

/* -------------------------------------------------------------------------
 * Seeded pseudo-randomness
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

function pick<T>(pool: readonly T[], rng: () => number): T {
  const value = pool[Math.floor(rng() * pool.length)];
  if (value === undefined) throw new Error("Cannot pick from an empty pool.");
  return value;
}

/* -------------------------------------------------------------------------
 * Synthetic reference data
 * ---------------------------------------------------------------------- */

const FIRST_NAMES = [
  "Amara", "Kofi", "Lena", "Omar", "Priya", "Maya", "Sofia", "Liam", "Ava", "Noah",
  "Isla", "Elias", "Maeve", "Jonas", "Zara", "Hana", "Mateo", "Ines", "Kai", "Nia",
  "Leo", "Mia", "Arjun", "Freya", "Diego", "Yuki", "Nora", "Felix", "Alba", "Ravi",
] as const;

const LAST_NAMES = [
  "Keller", "Okoro", "Osei", "Nair", "Petrova", "Haddad", "Nakamura", "Silva", "Novak", "Berg",
  "Costa", "Hughes", "Adeyemi", "Lindqvist", "Farah", "Duarte", "Moretti", "Okafor", "Rossi", "Tan",
  "Weber", "Jensen", "Bakker", "Lopez", "Kaur", "Mensah", "Ivanov", "Yamamoto", "Dlamini", "Freitas",
] as const;

const AGENTS: readonly InboxAssignee[] = [
  { id: "usr_agent_maya", name: "Maya Keller", teamId: "team_support_eu", teamName: "Support · EU" },
  { id: "usr_agent_kai", name: "Kai Nakamura", teamId: "team_support_eu", teamName: "Support · EU" },
  { id: "usr_agent_lena", name: "Lena Petrova", teamId: "team_support_asia", teamName: "Support · APAC" },
  { id: "usr_agent_omar", name: "Omar Haddad", teamId: "team_support_asia", teamName: "Support · APAC" },
];

const ESCALATION_OWNER: InboxAssignee = {
  id: "usr_sup_david",
  name: "David Okoro",
  teamId: "team_support_eu",
  teamName: "Support · EU",
};

const INTENT_POOL: readonly Intent[] = [
  ...INTENTS,
  "card_issue",
  "card_issue",
  "account_issue",
  "complaint",
  "transfer",
  "mobile_banking",
  "general_enquiry",
  "fraud_concern",
];

const SENTIMENT_POOL: readonly Sentiment[] = [
  ...SENTIMENTS,
  "neutral",
  "neutral",
  "frustrated",
  "frustrated",
  "positive",
  "angry",
  "urgent",
];

const PRIORITY_BY_INTENT: Record<Intent, Priority> = {
  card_issue: "high",
  transfer: "medium",
  mobile_banking: "medium",
  account_issue: "high",
  fraud_concern: "critical",
  complaint: "high",
  loan_enquiry: "normal",
  branch_enquiry: "low",
  general_enquiry: "normal",
  other: "low",
};

const PREVIEWS: Record<Intent, readonly string[]> = {
  card_issue: [
    "My card was declined again at the till, this is the third time this week.",
    "I was charged twice for the same purchase and need this reversed.",
    "The card I ordered two weeks ago still hasn't arrived.",
  ],
  transfer: [
    "I sent money to the wrong account by mistake, can you recall it?",
    "My transfer has been pending for four hours now.",
    "Why is there a fee on an internal transfer?",
  ],
  mobile_banking: [
    "The app keeps logging me out as soon as I open it.",
    "I can't set up Face ID on the new phone.",
    "Statement download fails on the latest update.",
  ],
  account_issue: [
    "My account shows a balance that doesn't match my records.",
    "I can't update the address on my account.",
    "Two of my accounts appear to have been merged by mistake.",
  ],
  fraud_concern: [
    "There is a transaction I did not make, I think my card is compromised.",
    "Someone tried to open an account in my name, please freeze everything.",
    "I received a text asking for my PIN claiming to be from you.",
  ],
  complaint: [
    "I have been on hold for two days and nobody has helped me yet.",
    "This is the second time I've had to explain the same problem.",
    "I want to make a formal complaint about how this was handled.",
  ],
  loan_enquiry: [
    "What documents do I need to apply for a small business loan?",
    "Can I get a quote on refinancing my mortgage?",
    "How long does loan pre-approval usually take?",
  ],
  branch_enquiry: [
    "Is the city centre branch open on Saturdays?",
    "Can I book an appointment with an advisor this week?",
    "Which branch can notarise documents for me?",
  ],
  general_enquiry: [
    "What are the international transfer limits for my plan?",
    "Do you support Apple Pay yet?",
    "How do I turn off paper statements?",
  ],
  other: [
    "Quick question about the rewards program, thanks in advance.",
    "Following up on my earlier message, any update?",
    "Not sure who to ask, hoping you can point me in the right direction.",
  ],
};

const HANDLE_SUFFIXES = ["", "_", ".", "x", "_o", "1", ".h", "k"] as const;

/* -------------------------------------------------------------------------
 * Generation
 * ---------------------------------------------------------------------- */

function buildCustomers(rng: () => number): readonly InboxCustomer[] {
  const customers: InboxCustomer[] = [];
  for (let i = 0; i < 60; i += 1) {
    const first = pick(FIRST_NAMES, rng);
    const last = pick(LAST_NAMES, rng);
    const suffix = i < FIRST_NAMES.length ? HANDLE_SUFFIXES[i % HANDLE_SUFFIXES.length] ?? "" : "";
    customers.push({
      id: `cus_${String(i).padStart(3, "0")}`,
      name: `${first} ${last}`,
      handle: `@${first.toLowerCase()}${suffix === "" ? "_" : String(suffix)}${last.toLowerCase()}`.replace(/\./g, ""),
    });
  }
  return customers;
}

function receivedOffsetMinutes(rng: () => number): number {
  const roll = rng();
  if (roll < 0.38) return Math.floor(rng() * 240);
  if (roll < 0.68) return 240 + Math.floor(rng() * (48 * 60 - 240));
  if (roll < 0.88) return 48 * 60 + Math.floor(rng() * (14 * 24 * 60 - 48 * 60));
  return 14 * 24 * 60 + Math.floor(rng() * (26 * 24 * 60));
}

function buildConversations(now: Date, rng: () => number): readonly InboxConversation[] {
  const customers = buildCustomers(rng);
  const conversations: InboxConversation[] = [];

  for (let i = 0; i < 128; i += 1) {
    const channel = CHANNELS[i % CHANNELS.length] ?? "instagram";
    const customer = customers[Math.floor(rng() * customers.length)] ?? customers[0];
    if (!customer) throw new Error("No customers generated.");

    const intent = INTENT_POOL[i % INTENT_POOL.length] ?? "other";
    const sentiment = SENTIMENT_POOL[i % SENTIMENT_POOL.length] ?? "neutral";
    let priority = PRIORITY_BY_INTENT[intent];
    if (sentiment === "urgent") priority = priority === "critical" ? "critical" : "high";
    if (sentiment === "positive" && (priority === "medium" || priority === "normal")) priority = "low";

    const offsetMin = receivedOffsetMinutes(rng);
    const receivedAt = new Date(now.getTime() - offsetMin * MINUTE_MS);

    const escalated = rng() < 0.11;
    const hasResponse = !escalated && rng() < 0.58;

    let status: ConversationStatus;
    if (escalated) status = "escalated";
    else if (!hasResponse) status = rng() < 0.6 ? "open" : "pending";
    else {
      const roll = rng();
      if (roll < 0.3) status = "awaiting_customer";
      else if (roll < 0.52) status = "resolved";
      else status = "pending";
    }

    const preview =
      pick(PREVIEWS[intent], rng) ?? PREVIEWS[intent][0] ?? "Customer message awaiting review.";

    let respondedAt: Date | null = null;
    let lastMessageAt = receivedAt;
    if (hasResponse) {
      const maxDelay = Math.max(1, Math.floor(offsetMin * 0.55));
      const delayMin = Math.min(3 + Math.floor(rng() * 40), maxDelay);
      respondedAt = new Date(receivedAt.getTime() + delayMin * MINUTE_MS);
      if (status === "awaiting_customer") {
        lastMessageAt = respondedAt;
      } else {
        const followUpMs = (10 + Math.floor(rng() * 170)) * MINUTE_MS;
        lastMessageAt = new Date(Math.min(now.getTime(), respondedAt.getTime() + followUpMs));
      }
    }

    let unread = rng() < 0.34;
    if (!hasResponse && status === "open") unread = true;
    if (status === "resolved") unread = false;

    let needsReview = status === "resolved";
    if (hasResponse && status !== "resolved") needsReview = rng() < 0.25;

    const slaPaused = status === "pending" && rng() < 0.2;

    let assignedTo: InboxAssignee | null;
    if (i < AGENTS.length * 4) {
      assignedTo = AGENTS[i % AGENTS.length] ?? AGENTS[0] ?? null;
    } else if (status === "escalated") {
      assignedTo = rng() < 0.85 ? ESCALATION_OWNER : null;
    } else if (hasResponse) {
      assignedTo = rng() < 0.6 ? pick(AGENTS, rng) : null;
    } else {
      assignedTo = rng() < 0.45 ? pick(AGENTS, rng) : null;
    }

    conversations.push({
      id: `cv_${String(i).padStart(4, "0")}`,
      channel,
      customer,
      receivedAt,
      lastMessageAt,
      respondedAt,
      preview,
      intent,
      sentiment,
      priority,
      status,
      slaPaused,
      needsReview,
      assignedTo,
      unread,
    });
  }

  return conversations;
}

/* -------------------------------------------------------------------------
 * Store
 * ---------------------------------------------------------------------- */

type MutableConversation = { -readonly [K in keyof InboxConversation]: InboxConversation[K] };

export interface InboxListResult {
  readonly items: readonly InboxConversation[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface InboxStore {
  /** All conversations matching the query, most recent first, paginated. */
  list(query: InboxQuery, now?: Date): InboxListResult;
  getById(id: string): InboxConversation | null;
  /** Set the read state of one conversation; returns the updated record or null. */
  markRead(id: string, read: boolean): InboxConversation | null;
  /** Global search across conversations and customers. */
  search(term: string, limitPerGroup?: number): readonly SearchResultGroup[];
  /** Distinct filter values present in the dataset, for the filter controls. */
  options(): InboxFilterOptions;
  /** Count of conversations needing attention for a role, for the sidebar badge. */
  attentionCount(role: string | null, userId: string | null): number;
}

export function buildInboxStore(now: Date = new Date()): InboxStore {
  const conversations: MutableConversation[] = buildConversations(
    now,
    mulberry32(0x5e1a4d1),
  ).map((conversation) => ({ ...conversation }) as MutableConversation);
  const customers = conversations.reduce<InboxCustomer[]>((all, conversation) => {
    if (!all.some((customer) => customer.id === conversation.customer.id)) {
      all.push(conversation.customer);
    }
    return all;
  }, []);

  function list(query: InboxQuery, at: Date = new Date()): InboxListResult {
    const matching = conversations
      .filter((conversation) => matchesInboxQuery(conversation, query, at))
      .sort(compareByRecency);

    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = Math.max(1, query.page ?? 1);
    const start = (page - 1) * pageSize;
    return {
      items: matching.slice(start, start + pageSize),
      total: matching.length,
      page,
      pageSize,
    };
  }

  function getById(id: string): InboxConversation | null {
    return conversations.find((conversation) => conversation.id === id) ?? null;
  }

  function markRead(id: string, read: boolean): InboxConversation | null {
    const conversation = conversations.find((candidate) => candidate.id === id);
    if (!conversation) return null;
    conversation.unread = !read;
    return conversation;
  }

  function search(term: string, limitPerGroup = 8): readonly SearchResultGroup[] {
    const query = term.trim().toLowerCase();
    if (query.length < 2) return [];

    const conversationItems = conversations
      .filter((conversation) => conversationContainsText(conversation, query))
      .sort(compareByRecency)
      .slice(0, limitPerGroup)
      .map((conversation) => ({
        id: conversation.id,
        label: conversation.customer.name,
        sublabel: `${CHANNEL_LABELS[conversation.channel]} · ${conversation.preview}`,
        href: `/inbox?conversation=${conversation.id}`,
      }));

    const firstConversationByCustomer = new Map<string, string>();
    for (const conversation of [...conversations].sort(compareByRecency)) {
      if (!firstConversationByCustomer.has(conversation.customer.id)) {
        firstConversationByCustomer.set(conversation.customer.id, conversation.id);
      }
    }

    const customerItems = customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) || customer.handle.toLowerCase().includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limitPerGroup)
      .map((customer) => ({
        id: customer.id,
        label: customer.name,
        sublabel: customer.handle,
        href: `/inbox?conversation=${firstConversationByCustomer.get(customer.id) ?? ""}`,
      }));

    return [
      { id: "conversations", label: "Conversations", items: conversationItems },
      { id: "customers", label: "Customers", items: customerItems },
    ].filter((group) => group.items.length > 0);
  }

  function options(): InboxFilterOptions {
    const assignees = new Map<string, { id: string; name: string; teamName: string }>();
    const teams = new Map<string, string>();
    for (const conversation of conversations) {
      if (!conversation.assignedTo) continue;
      const { id, name, teamId, teamName } = conversation.assignedTo;
      assignees.set(id, { id, name, teamName });
      teams.set(teamId, teamName);
    }

    return {
      channels: CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABELS[channel] })),
      intents: INTENTS.map((intent) => ({ value: intent, label: INTENT_META[intent] })),
      sentiments: SENTIMENTS.map((sentiment) => ({
        value: sentiment,
        label: SENTIMENT_META[sentiment].label,
      })),
      priorities: PRIORITIES.map((priority) => ({
        value: priority,
        label: PRIORITY_META[priority].label,
      })),
      slaStates: [
        { value: "safe", label: "On track" },
        { value: "warning", label: "At risk" },
        { value: "breached", label: "Breached" },
        { value: "met", label: "Met" },
        { value: "paused", label: "Paused" },
      ],
      assignees: [...assignees.values()].sort((a, b) => a.name.localeCompare(b.name)),
      teams: [...teams.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  function attentionCount(role: string | null, userId: string | null): number {
    switch (role) {
      case "AGENT":
        return conversations.filter(
          (conversation) =>
            conversation.unread &&
            (conversation.assignedTo === null || conversation.assignedTo.id === userId),
        ).length;
      case "SUPERVISOR":
        return conversations.filter(
          (conversation) => conversation.status === "escalated" || conversation.needsReview,
        ).length;
      case "QA":
        return conversations.filter((conversation) => conversation.needsReview).length;
      default:
        return 0;
    }
  }

  return { list, getById, markRead, search, options, attentionCount };
}

/** Process-wide store used by the app. Reset is exposed for tests only. */
let activeStore = buildInboxStore();

export function demoInboxStore(): InboxStore {
  return activeStore;
}

export function resetDemoInboxStore(now: Date = new Date()): InboxStore {
  activeStore = buildInboxStore(now);
  return activeStore;
}