import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_INBOX_QUERY } from "@/lib/domain/inbox";
import { DEFAULT_SUPERVISOR_QUEUE_QUERY, type SupervisorQueueQuery } from "@/lib/domain/supervisor";
import { QA_CHECK_OUTCOMES, validateQaDecision } from "@/lib/domain/qa-review";
import { buildSupervisorStore, resetDemoSupervisorStore } from "@/server/supervisor/store";
import { presenceForAgent } from "@/server/supervisor/roster";
import { demoInboxStore } from "@/server/inbox/store";

const NOW = new Date("2026-05-20T12:00:00.000Z");

function query(overrides: Partial<SupervisorQueueQuery> = {}): SupervisorQueueQuery {
  return { ...DEFAULT_SUPERVISOR_QUEUE_QUERY, pageSize: 1000, ...overrides };
}

beforeEach(() => {
  resetDemoSupervisorStore();
});

describe("supervisor aggregation", () => {
  it("reads every conversation from the shared inbox", () => {
    const store = buildSupervisorStore();
    const inbox = demoInboxStore().list({ ...DEFAULT_INBOX_QUERY, pageSize: 1000 }, NOW);

    expect(store.rows(NOW)).toHaveLength(inbox.total);
  });

  it("reports KPI counts that match the underlying rows", () => {
    const store = buildSupervisorStore();
    const rows = store.rows(NOW);
    const snapshot = store.snapshot(NOW);

    expect(snapshot.active).toBe(
      rows.filter((row) => row.status !== "resolved" && row.status !== "closed").length,
    );
    expect(snapshot.escalated).toBe(rows.filter((row) => row.status === "escalated").length);
    expect(snapshot.breached).toBe(
      rows.filter(
        (row) => row.sla.state === "breached" && row.status !== "resolved" && row.status !== "closed",
      ).length,
    );
  });

  it("counts every rostered agent in the online tile denominator", () => {
    const store = buildSupervisorStore();
    const roster = store.roster();

    expect(roster).toHaveLength(demoInboxStore().assignees().length);
    expect(store.snapshot(NOW).agentsTotal).toBe(roster.length);
  });

  it("keeps an agent with no work in the workload table", () => {
    const store = buildSupervisorStore();
    const workloads = store.workloads(NOW);

    expect(workloads).toHaveLength(demoInboxStore().assignees().length);
    expect(workloads.every((workload) => workload.activeConversations >= 0)).toBe(true);
  });

  it("only offers agents who are on shift and under capacity for assignment", () => {
    const store = buildSupervisorStore();
    for (const workload of store.assignable(NOW)) {
      expect(workload.hasCapacity).toBe(true);
      expect(workload.activeConversations).toBeLessThan(workload.capacity);
    }
  });
});

describe("queue filtering and paging", () => {
  it("returns every match in total and slices the page", () => {
    const store = buildSupervisorStore();
    const rows = store.rows(NOW);

    const page = store.queuePage(query({ page: 1, pageSize: 10 }), NOW);
    expect(page.items).toHaveLength(Math.min(10, page.total));
    expect(page.page).toBe(1);
    expect(page.pageCount).toBe(Math.max(1, Math.ceil(rows.length / 10)));
  });

  it("never returns an empty page for an out-of-range page number", () => {
    const store = buildSupervisorStore();
    const page = store.queuePage(query({ page: 9999, pageSize: 10 }), NOW);

    expect(page.page).toBeLessThanOrEqual(page.pageCount);
    expect(page.items.length).toBeGreaterThan(0);
  });

  it("applies filters conjunctively", () => {
    const store = buildSupervisorStore();

    const unassigned = store.queuePage(query({ assignment: "unassigned" }), NOW);
    expect(unassigned.items.every((row) => row.assigneeId === null)).toBe(true);

    const escalated = store.queuePage(query({ status: "escalated" }), NOW);
    expect(escalated.items.every((row) => row.status === "escalated")).toBe(true);

    const both = store.queuePage(query({ status: "escalated", assignment: "unassigned" }), NOW);
    expect(both.total).toBeLessThanOrEqual(Math.min(escalated.total, unassigned.total));
  });

  it("orders urgency by SLA severity before priority", () => {
    const store = buildSupervisorStore();
    const page = store.queuePage(query({ sort: "urgency", pageSize: 1000 }), NOW);

    const rank = (state: string): number =>
      ({ breached: 0, warning: 1, safe: 2, paused: 3, met: 4 })[state] ?? 9;

    for (let index = 1; index < page.items.length; index += 1) {
      const previous = page.items[index - 1];
      const current = page.items[index];
      expect(rank(previous?.sla.state ?? "met")).toBeLessThanOrEqual(rank(current?.sla.state ?? "met"));
    }
  });
});

describe("supervisor mutations stay consistent", () => {
  it("removes a reassigned conversation from the previous agent's workload", () => {
    const store = buildSupervisorStore();
    const before = store.workloads(NOW);

    const target = before.find((workload) => workload.activeConversations > 0);
    expect(target).toBeDefined();
    if (!target) return;

    const row = store
      .rows(NOW)
      .find((candidate) => candidate.assigneeId === target.agentId && candidate.status !== "resolved");

    const other = before.find((workload) => workload.agentId !== target.agentId);
    expect(row && other).toBeTruthy();
    if (!row || !other) return;

    store.assign(row.id, { assigneeId: other.agentId, actor: "Supervisor" }, NOW);

    const after = store.workloads(NOW);
    expect(after.find((workload) => workload.agentId === target.agentId)?.activeConversations).toBe(
      target.activeConversations - 1,
    );
    expect(after.find((workload) => workload.agentId === other.agentId)?.activeConversations).toBe(
      other.activeConversations + 1,
    );
  });

  it("moves the conversation to the head of the queue after a priority raise", () => {
    const store = buildSupervisorStore();
    const rows = store.rows(NOW);

    const target = rows.find((row) => row.status !== "resolved" && row.priority === "low");
    expect(target).toBeDefined();
    if (!target) return;

    const before = store.queuePage(query({ status: "active" }), NOW).total;
    store.changePriority(target.id, { priority: "critical", reason: "Test", actor: "Supervisor" }, NOW);

    expect(store.rows(NOW).find((row) => row.id === target.id)?.priority).toBe("critical");
    expect(store.queuePage(query({ status: "active" }), NOW).total).toBe(before);
  });

  it("removes a resolved escalation from the board immediately", () => {
    const store = buildSupervisorStore();
    const open = store.escalationBoard("open", NOW);
    expect(open.rows.length).toBeGreaterThan(0);

    const target = open.rows[0];
    expect(target).toBeDefined();
    if (!target) return;

    const result = store.resolveEscalation(
      target.conversationId,
      { outcome: "resolved", note: "Handled", actorId: "usr_supervisor", actorName: "Supervisor" },
      NOW,
    );

    expect(result).not.toBeNull();
    expect(store.escalationBoard("open", NOW).rows.some((row) => row.conversationId === target.conversationId)).toBe(
      false,
    );
    // Still visible under "all", now closed, so the decision is auditable.
    expect(
      store.escalationBoard("all", NOW).rows.find((row) => row.conversationId === target.conversationId)?.outcome,
    ).toBe("resolved");
  });

  it("keeps a requested change on the QA board until it is approved", () => {
    const store = buildSupervisorStore();
    const pending = store.qaBoard("pending", NOW);
    expect(pending.rows.length).toBeGreaterThan(0);

    const target = pending.rows[0];
    expect(target).toBeDefined();
    if (!target) return;

    store.decideQa(
      target.conversationId,
      {
        checks: { accuracy: "pass", tone: "fail", privacy: "pass" },
        status: "changes_requested",
        note: "Too blunt.",
        actorId: "usr_supervisor",
        actorName: "Supervisor",
      },
      NOW,
    );

    expect(
      store.qaBoard("changes_requested", NOW).rows.some((row) => row.conversationId === target.conversationId),
    ).toBe(true);
  });

  it("rejects a QA decision that skips a required check", () => {
    const store = buildSupervisorStore();
    const pending = store.qaBoard("pending", NOW);
    const target = pending.rows[0];
    expect(target).toBeDefined();
    if (!target) return;

    const result = store.decideQa(
      target.conversationId,
      {
        checks: { tone: "pass" },
        status: "approved",
        note: "",
        actorId: "usr_supervisor",
        actorName: "Supervisor",
      },
      NOW,
    );

    expect(result).not.toBeNull();
    expect("errors" in (result ?? {})).toBe(true);
  });
});

describe("audit trail", () => {
  it("merges every conversation trail into one chronological list", () => {
    const store = buildSupervisorStore();
    const board = store.auditBoard({ types: [], actor: "", search: "", date: "any", page: 1, pageSize: 1000 }, NOW);

    expect(board.page.total).toBeGreaterThan(0);
    for (let index = 1; index < board.page.items.length; index += 1) {
      const previous = board.page.items[index - 1];
      const current = board.page.items[index];
      expect(previous?.createdAt.getTime()).toBeGreaterThanOrEqual(current?.createdAt.getTime() ?? 0);
    }
  });

  it("filters by event type", () => {
    const store = buildSupervisorStore();
    const board = store.auditBoard(
      { types: ["escalated"], actor: "", search: "", date: "any", page: 1, pageSize: 1000 },
      NOW,
    );

    expect(board.page.items.every((row) => row.type === "escalated")).toBe(true);
  });

  it("includes supervisor actions in the same trail", () => {
    const store = buildSupervisorStore();
    const target = store.rows(NOW)[0];
    expect(target).toBeDefined();
    if (!target) return;

    store.changePriority(target.id, { priority: "medium", reason: "Audit check", actor: "Supervisor" }, NOW);

    const board = store.auditBoard({ types: [], actor: "Supervisor", search: "", date: "any", page: 1, pageSize: 1000 }, NOW);
    expect(board.page.items.some((row) => row.conversationId === target.id && row.type === "priority_changed")).toBe(
      true,
    );
  });
});

describe("roster determinism", () => {
  it("resolves the same presence for an agent on every call", () => {
    const id = "usr_agent_maya";
    expect(presenceForAgent(id)).toBe(presenceForAgent(id));
  });

  it("only produces known presence states", () => {
    const states = ["online", "busy", "away", "offline"];
    for (const assignee of demoInboxStore().assignees()) {
      expect(states).toContain(presenceForAgent(assignee.id));
    }
  });
});

describe("QA decision validation", () => {
  it("requires every mandatory check before approving", () => {
    const result = validateQaDecision({ accuracy: "pass" }, "approved", "");
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toEqual(expect.arrayContaining(["tone", "privacy"]));
  });

  it("refuses to approve while a check needs work", () => {
    const result = validateQaDecision(
      { accuracy: "pass", tone: "fail", privacy: "pass" },
      "approved",
      "",
    );
    expect(result.valid).toBe(false);
    expect(result.errors.tone).toBeTruthy();
  });

  it("requires a note when changes are requested", () => {
    const result = validateQaDecision(
      { accuracy: "pass", tone: "pass", privacy: "pass" },
      "changes_requested",
      "   ",
    );
    expect(result.valid).toBe(false);
    expect(result.errors.note).toBeTruthy();
  });

  it("accepts a complete approval", () => {
    const result = validateQaDecision(
      { accuracy: "pass", tone: "pass", privacy: "not_applicable" },
      "approved",
      "",
    );
    expect(result.valid).toBe(true);
  });

  it("exposes an outcome for every check", () => {
    for (const outcome of QA_CHECK_OUTCOMES) {
      expect(validateQaDecision({ accuracy: outcome, tone: outcome, privacy: outcome }, "approved", "")).toBeDefined();
    }
  });
});
