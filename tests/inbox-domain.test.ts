import { describe, expect, it } from "vitest";

import { DAY_MS, HOUR_MS, MINUTE_MS, formatRelativeTime } from "@/lib/format";
import {
  DEFAULT_INBOX_QUERY,
  compareByRecency,
  conversationContainsText,
  matchesInboxQuery,
  slaEvaluationOf,
  toInboxConversationDto,
  type InboxConversation,
  type InboxQuery,
} from "@/lib/domain/inbox";

const NOW = new Date("2026-05-20T12:00:00.000Z");

function conv(overrides: Partial<InboxConversation> = {}): InboxConversation {
  return {
    id: "cv_0001",
    channel: "instagram",
    customer: { id: "cus_1", name: "Maya Keller", handle: "@maya_keller" },
    receivedAt: new Date(NOW.getTime() - 3 * HOUR_MS),
    lastMessageAt: new Date(NOW.getTime() - 5 * MINUTE_MS),
    respondedAt: null,
    preview: "My card was declined twice today",
    intent: "card_issue",
    sentiment: "frustrated",
    priority: "high",
    status: "open",
    slaPaused: false,
    needsReview: false,
    assignedTo: null,
    unread: true,
    ...overrides,
  };
}

function query(overrides: Partial<InboxQuery> = {}): InboxQuery {
  return { ...DEFAULT_INBOX_QUERY, ...overrides };
}

describe("inbox views", () => {
  it("matches every conversation for the default 'all' view", () => {
    expect(matchesInboxQuery(conv(), query(), NOW)).toBe(true);
  });

  it("filters to conversations assigned to the signed-in user", () => {
    const assigned = conv({ assignedTo: { id: "usr_agent_maya", name: "Maya", teamId: "t1", teamName: "EU" } });
    expect(matchesInboxQuery(assigned, query({ view: "assigned", userId: "usr_agent_maya" }), NOW)).toBe(true);
    expect(matchesInboxQuery(assigned, query({ view: "assigned", userId: "usr_agent_kai" }), NOW)).toBe(false);
    expect(matchesInboxQuery(conv(), query({ view: "assigned", userId: "usr_agent_maya" }), NOW)).toBe(false);
  });

  it("filters needs-review, priority, awaiting-customer and escalated buckets", () => {
    expect(matchesInboxQuery(conv({ needsReview: true }), query({ view: "review" }), NOW)).toBe(true);
    expect(matchesInboxQuery(conv({ needsReview: false }), query({ view: "review" }), NOW)).toBe(false);

    expect(matchesInboxQuery(conv({ priority: "critical" }), query({ view: "priority" }), NOW)).toBe(true);
    expect(matchesInboxQuery(conv({ priority: "medium" }), query({ view: "priority" }), NOW)).toBe(false);

    expect(matchesInboxQuery(conv({ status: "awaiting_customer" }), query({ view: "awaiting" }), NOW)).toBe(true);
    expect(matchesInboxQuery(conv({ status: "open" }), query({ view: "awaiting" }), NOW)).toBe(false);

    expect(matchesInboxQuery(conv({ status: "escalated" }), query({ view: "escalated" }), NOW)).toBe(true);
    expect(matchesInboxQuery(conv({ status: "open" }), query({ view: "escalated" }), NOW)).toBe(false);
  });
});

describe("inbox dimension filters", () => {
  it("applies channel, intent, sentiment and priority conjunctively", () => {
    const item = conv({ channel: "x", intent: "fraud_concern", sentiment: "angry", priority: "critical" });
    expect(
      matchesInboxQuery(
        item,
        query({ channels: ["x", "tiktok"], intent: "fraud_concern", sentiment: "angry", priority: "critical" }),
        NOW,
      ),
    ).toBe(true);
    expect(matchesInboxQuery(item, query({ channels: ["instagram"] }), NOW)).toBe(false);
    expect(matchesInboxQuery(item, query({ intent: "card_issue" }), NOW)).toBe(false);
    expect(matchesInboxQuery(item, query({ sentiment: "positive" }), NOW)).toBe(false);
    expect(matchesInboxQuery(item, query({ priority: "low" }), NOW)).toBe(false);
  });

  it("filters by assignee and team", () => {
    const item = conv({ assignedTo: { id: "a1", name: "Kai", teamId: "team_apac", teamName: "APAC" } });
    expect(matchesInboxQuery(item, query({ assigneeId: "a1" }), NOW)).toBe(true);
    expect(matchesInboxQuery(item, query({ assigneeId: "a2" }), NOW)).toBe(false);
    expect(matchesInboxQuery(item, query({ teamId: "team_apac" }), NOW)).toBe(true);
    expect(matchesInboxQuery(item, query({ teamId: "team_eu" }), NOW)).toBe(false);
  });

  it("filters by computed SLA state", () => {
    const breached = conv({ priority: "high", receivedAt: new Date(NOW.getTime() - 4 * HOUR_MS), respondedAt: null });
    const safe = conv({ priority: "normal", receivedAt: new Date(NOW.getTime() - 5 * MINUTE_MS), respondedAt: null });
    const met = conv({ receivedAt: new Date(NOW.getTime() - 3 * HOUR_MS), respondedAt: new Date(NOW.getTime() - 2 * HOUR_MS) });

    expect(matchesInboxQuery(breached, query({ sla: "breached" }), NOW)).toBe(true);
    expect(matchesInboxQuery(safe, query({ sla: "safe" }), NOW)).toBe(true);
    expect(matchesInboxQuery(met, query({ sla: "met" }), NOW)).toBe(true);
    expect(matchesInboxQuery(breached, query({ sla: "safe" }), NOW)).toBe(false);
  });

  it("filters by date presets against the last message", () => {
    const today = conv({ lastMessageAt: new Date(NOW.getTime() - HOUR_MS) });
    const threeDays = conv({ lastMessageAt: new Date(NOW.getTime() - 3 * DAY_MS) });
    const threeWeeks = conv({ lastMessageAt: new Date(NOW.getTime() - 21 * DAY_MS) });
    const old = conv({ lastMessageAt: new Date(NOW.getTime() - 40 * DAY_MS) });

    expect(matchesInboxQuery(today, query({ date: "today" }), NOW)).toBe(true);
    expect(matchesInboxQuery(threeDays, query({ date: "today" }), NOW)).toBe(false);
    expect(matchesInboxQuery(threeDays, query({ date: "week" }), NOW)).toBe(true);
    expect(matchesInboxQuery(threeWeeks, query({ date: "week" }), NOW)).toBe(false);
    expect(matchesInboxQuery(threeWeeks, query({ date: "month" }), NOW)).toBe(true);
    expect(matchesInboxQuery(old, query({ date: "older_month" }), NOW)).toBe(true);
  });

  it("matches free-text against name, handle, preview and intent label", () => {
    const item = conv();
    expect(conversationContainsText(item, "maya")).toBe(true);
    expect(conversationContainsText(item, "@maya_keller")).toBe(true);
    expect(conversationContainsText(item, "declined")).toBe(true);
    expect(conversationContainsText(item, "card issue")).toBe(true);
    expect(conversationContainsText(item, "refund")).toBe(false);

    expect(matchesInboxQuery(item, query({ search: "MAYA" }), NOW)).toBe(true);
    expect(matchesInboxQuery(item, query({ search: "nothing-here" }), NOW)).toBe(false);
  });
});

describe("SLA evaluation and ordering", () => {
  it("derives each SLA state from timestamps", () => {
    expect(slaEvaluationOf(conv({ receivedAt: new Date(NOW.getTime() - MINUTE_MS) }), NOW).state).toBe("safe");
    expect(
      slaEvaluationOf(conv({ priority: "high", receivedAt: new Date(NOW.getTime() - 50 * MINUTE_MS) }), NOW).state,
    ).toBe("warning");
    expect(
      slaEvaluationOf(conv({ priority: "high", receivedAt: new Date(NOW.getTime() - 4 * HOUR_MS) }), NOW).state,
    ).toBe("breached");
    expect(
      slaEvaluationOf(
        conv({ receivedAt: new Date(NOW.getTime() - 3 * HOUR_MS), respondedAt: new Date(NOW.getTime() - 2 * HOUR_MS) }),
        NOW,
      ).state,
    ).toBe("met");
    expect(slaEvaluationOf(conv({ slaPaused: true }), NOW).state).toBe("paused");
  });

  it("orders most-recent first with a stable tiebreak", () => {
    const older = conv({ id: "cv_a", lastMessageAt: new Date(NOW.getTime() - 2 * HOUR_MS) });
    const newer = conv({ id: "cv_b", lastMessageAt: new Date(NOW.getTime() - HOUR_MS) });
    expect([older, newer].sort(compareByRecency).map((item) => item.id)).toEqual(["cv_b", "cv_a"]);
  });

  it("serialises dates to ISO strings", () => {
    const dto = toInboxConversationDto(conv({ respondedAt: new Date(NOW.getTime() - HOUR_MS) }));
    expect(typeof dto.receivedAt).toBe("string");
    expect(dto.receivedAt).toBe(new Date(NOW.getTime() - 3 * HOUR_MS).toISOString());
    expect(dto.respondedAt).toBe(new Date(NOW.getTime() - HOUR_MS).toISOString());
  });
});

describe("formatRelativeTime", () => {
  it("renders coarse relative labels", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() - 10_000), NOW)).toBe("just now");
    expect(formatRelativeTime(new Date(NOW.getTime() - 5 * MINUTE_MS), NOW)).toBe("5m ago");
    expect(formatRelativeTime(new Date(NOW.getTime() - 3 * HOUR_MS), NOW)).toBe("3h ago");
    expect(formatRelativeTime(new Date(NOW.getTime() - 2 * DAY_MS), NOW)).toBe("2d ago");
    expect(formatRelativeTime(new Date(NOW.getTime() - 14 * DAY_MS), NOW)).toBe("2w ago");
  });
});