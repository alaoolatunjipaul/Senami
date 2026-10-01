import { beforeEach, describe, expect, it } from "vitest";

import { CHANNELS } from "@/lib/config";
import { DEFAULT_INBOX_QUERY, type InboxQuery } from "@/lib/domain/inbox";
import { INTENTS, PRIORITIES, SENTIMENTS } from "@/lib/domain/taxonomy";
import { buildInboxStore, demoInboxStore, resetDemoInboxStore } from "@/server/inbox/store";

const NOW = new Date("2026-05-20T12:00:00.000Z");
const ALL: InboxQuery = { ...DEFAULT_INBOX_QUERY, pageSize: 1000 };

function query(overrides: Partial<InboxQuery> = {}): InboxQuery {
  return { ...DEFAULT_INBOX_QUERY, ...overrides };
}

describe("inbox store generation", () => {
  it("is deterministic for ids, order and categories", () => {
    const a = buildInboxStore(NOW).list(ALL, NOW);
    const b = buildInboxStore(NOW).list(ALL, NOW);
    expect(a.total).toBe(128);
    expect(a.items.map((item) => item.id)).toEqual(b.items.map((item) => item.id));
    expect(a.items.map((item) => item.channel)).toEqual(b.items.map((item) => item.channel));
    expect(a.items.map((item) => item.intent)).toEqual(b.items.map((item) => item.intent));
  });

  it("orders most recent first and paginates with distinct ids", () => {
    const store = buildInboxStore(NOW);
    const first = store.list(query({ page: 1, pageSize: 25 }), NOW);
    const second = store.list(query({ page: 2, pageSize: 25 }), NOW);
    expect(first.items).toHaveLength(25);
    expect(new Set(first.items.map((item) => item.id)).size).toBe(25);
    const overlap = first.items.filter((item) => second.items.some((other) => other.id === item.id));
    expect(overlap).toHaveLength(0);

    for (let i = 1; i < first.items.length; i += 1) {
      const previous = first.items[i - 1];
      const current = first.items[i];
      if (!previous || !current) throw new Error("missing item");
      expect(previous.lastMessageAt.getTime()).toBeGreaterThanOrEqual(current.lastMessageAt.getTime());
    }
  });

  it("exposes complete, real filter options", () => {
    const options = buildInboxStore(NOW).options();
    expect(options.channels.map((option) => option.value)).toEqual([...CHANNELS]);
    expect(options.intents.map((option) => option.value)).toEqual([...INTENTS]);
    expect(options.sentiments.map((option) => option.value)).toEqual([...SENTIMENTS]);
    expect(options.priorities.map((option) => option.value)).toEqual([...PRIORITIES]);
    expect(options.slaStates).toHaveLength(5);
    const assigneeIds = options.assignees.map((assignee) => assignee.id);
    expect(assigneeIds).toContain("usr_agent_maya");
    expect(assigneeIds).toContain("usr_agent_kai");
    expect(assigneeIds).toContain("usr_agent_lena");
    expect(assigneeIds).toContain("usr_agent_omar");
    expect(options.teams.length).toBeGreaterThan(0);
  });
});

describe("inbox store filtering", () => {
  const store = buildInboxStore(NOW);

  it("narrows by view buckets", () => {
    const all = store.list(ALL, NOW).total;
    const priority = store.list(query({ view: "priority", pageSize: 1000 }), NOW);
    const awaiting = store.list(query({ view: "awaiting", pageSize: 1000 }), NOW);
    const escalated = store.list(query({ view: "escalated", pageSize: 1000 }), NOW);

    expect(priority.total).toBeGreaterThan(0);
    expect(priority.total).toBeLessThan(all);
    expect(priority.items.every((item) => item.priority === "high" || item.priority === "critical")).toBe(true);

    expect(awaiting.total).toBeGreaterThan(0);
    expect(awaiting.items.every((item) => item.status === "awaiting_customer")).toBe(true);

    expect(escalated.total).toBeGreaterThan(0);
    expect(escalated.items.every((item) => item.status === "escalated")).toBe(true);
  });

  it("narrows by channel and by assignee", () => {
    const instagram = store.list(query({ channels: ["instagram"], pageSize: 1000 }), NOW);
    expect(instagram.total).toBeGreaterThan(0);
    expect(instagram.items.every((item) => item.channel === "instagram")).toBe(true);

    const maya = store.list(query({ view: "assigned", userId: "usr_agent_maya", pageSize: 1000 }), NOW);
    expect(maya.total).toBeGreaterThan(0);
    expect(maya.items.every((item) => item.assignedTo?.id === "usr_agent_maya")).toBe(true);
  });

  it("actually applies free-text search", () => {
    const any = store.list(query({ pageSize: 1 }), NOW).items[0];
    if (!any) throw new Error("no data");
    const matches = store.list(query({ search: any.customer.name, pageSize: 1000 }), NOW);
    expect(matches.total).toBeGreaterThan(0);
    expect(
      matches.items.every((item) =>
        `${item.customer.name} ${item.customer.handle} ${item.preview}`.toLowerCase().includes(any.customer.name.toLowerCase()),
      ),
    ).toBe(true);
  });
});

describe("inbox store mutations and aggregates", () => {
  beforeEach(() => {
    resetDemoInboxStore(NOW);
  });

  it("marks a conversation read without losing it", () => {
    const store = demoInboxStore();
    const allBefore = store.list(ALL, NOW);
    const target = allBefore.items.find((item) => item.unread);
    if (!target) throw new Error("expected at least one unread conversation");

    const updated = store.markRead(target.id, true);
    expect(updated?.unread).toBe(false);
    expect(store.getById(target.id)?.unread).toBe(false);
    expect(store.list(ALL, NOW).total).toBe(allBefore.total);

    store.markRead(target.id, false);
    expect(store.getById(target.id)?.unread).toBe(true);
  });

  it("returns null for unknown ids", () => {
    const store = demoInboxStore();
    expect(store.getById("cv_9999")).toBeNull();
    expect(store.markRead("cv_9999", true)).toBeNull();
  });

  it("restores the seed state on reset", () => {
    const store = demoInboxStore();
    const target = store.list(ALL, NOW).items.find((item) => item.unread);
    if (!target) throw new Error("expected at least one unread conversation");
    store.markRead(target.id, true);
    expect(store.getById(target.id)?.unread).toBe(false);

    const fresh = resetDemoInboxStore(NOW);
    expect(fresh.getById(target.id)?.unread).toBe(true);
  });

  it("computes role-aware attention counts", () => {
    const store = demoInboxStore();
    expect(store.attentionCount("AGENT", "usr_agent_maya")).toBeGreaterThan(0);
    expect(store.attentionCount("SUPERVISOR", null)).toBeGreaterThan(0);
    expect(store.attentionCount("QA", null)).toBeGreaterThan(0);
    expect(store.attentionCount("ADMIN", null)).toBe(0);
    expect(store.attentionCount(null, null)).toBe(0);
  });

  it("searches conversations and customers", () => {
    const store = demoInboxStore();
    expect(store.search("a")).toEqual([]);

    const conversation = store.list(query({ pageSize: 1 }), NOW).items[0];
    if (!conversation) throw new Error("no data");
    const groups = store.search(conversation.customer.name);
    const flat = groups.flatMap((group) => group.items);
    expect(flat.length).toBeGreaterThan(0);
    expect(flat.some((item) => item.label === conversation.customer.name)).toBe(true);
    expect(groups.some((group) => group.id === "customers")).toBe(true);
  });
});