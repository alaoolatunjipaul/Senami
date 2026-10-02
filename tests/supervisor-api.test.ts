import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { SESSION_COOKIE, buildSession, signSession } from "@/server/auth/session";
import { demoAccountForRole, profileFromAccount } from "@/server/auth/demo-users";
import { resetDemoSupervisorStore } from "@/server/supervisor/store";
import { resetDemoConversationStore } from "@/server/conversations/store";
import type { Role } from "@/lib/domain/user";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

import { GET as GET_OVERVIEW } from "@/app/api/supervisor/overview/route";
import { GET as GET_QUEUE } from "@/app/api/supervisor/queue/route";
import { GET as GET_TEAM } from "@/app/api/supervisor/team/route";
import { GET as GET_SLA } from "@/app/api/supervisor/sla/route";
import { GET as GET_ESCALATIONS } from "@/app/api/supervisor/escalations/route";
import { POST as POST_RESOLVE } from "@/app/api/supervisor/escalations/[id]/resolve/route";
import { GET as GET_QA } from "@/app/api/supervisor/qa/route";
import { POST as POST_QA } from "@/app/api/supervisor/qa/[id]/route";
import { GET as GET_PERFORMANCE } from "@/app/api/supervisor/performance/route";
import { GET as GET_AUDIT } from "@/app/api/supervisor/audit/route";
import { GET as GET_PERMISSIONS } from "@/app/api/supervisor/permissions/route";
import { PATCH as PATCH_PRIORITY } from "@/app/api/conversations/[id]/priority/route";

async function signInAs(role: Role): Promise<void> {
  const account = demoAccountForRole(role);
  if (!account) throw new Error(`no demo account for ${role}`);
  const token = await signSession(buildSession(profileFromAccount(account)));
  cookieStore.set(SESSION_COOKIE, token);
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function postRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function patchRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/** An escalated conversation id, or null when the dataset has none. */
async function escalatedId(): Promise<string | null> {
  const response = await GET_ESCALATIONS(getRequest("/api/supervisor/escalations?filter=open"));
  const body = await response.json();
  return body.rows?.[0]?.conversationId ?? null;
}

/** A conversation flagged for QA review, or null. */
async function qaId(): Promise<string | null> {
  const response = await GET_QA(getRequest("/api/supervisor/qa?filter=pending"));
  const body = await response.json();
  return body.items?.[0]?.conversationId ?? null;
}

beforeEach(() => {
  cookieStore.clear();
  resetDemoConversationStore();
  resetDemoSupervisorStore();
});

afterEach(() => {
  cookieStore.clear();
});

describe("supervisor API authorisation", () => {
  /**
   * Requests are issued sequentially rather than with `Promise.all`: the session
   * lookup performs a dynamic import of `next/headers`, and racing those imports
   * resolves the real module instead of the test double.
   */
  async function callEveryEndpoint(): Promise<number[]> {
    const statuses: number[] = [];
    statuses.push((await GET_OVERVIEW()).status);
    statuses.push((await GET_QUEUE(getRequest("/api/supervisor/queue"))).status);
    statuses.push((await GET_TEAM(getRequest("/api/supervisor/team"))).status);
    statuses.push((await GET_SLA()).status);
    statuses.push((await GET_ESCALATIONS(getRequest("/api/supervisor/escalations"))).status);
    statuses.push((await GET_QA(getRequest("/api/supervisor/qa"))).status);
    statuses.push((await GET_PERFORMANCE(getRequest("/api/supervisor/performance"))).status);
    statuses.push((await GET_AUDIT(getRequest("/api/supervisor/audit"))).status);
    statuses.push((await GET_PERMISSIONS()).status);
    return statuses;
  }

  it("rejects every supervisor endpoint without a session", async () => {
    for (const status of await callEveryEndpoint()) {
      expect(status).toBe(401);
    }
  });

  it("denies the console to an agent", async () => {
    await signInAs("AGENT");

    for (const status of await callEveryEndpoint()) {
      expect(status).toBe(403);
    }
  });

  it("denies the QA queue to a supervisor without qa.view", async () => {
    await signInAs("QA");
    // QA holds qa.view but not supervisor.queue.view.
    expect((await GET_QA(getRequest("/api/supervisor/qa"))).status).toBe(200);
    expect((await GET_OVERVIEW()).status).toBe(403);
  });

  it("denies agent access to the QA queue", async () => {
    await signInAs("AGENT");
    expect((await GET_QA(getRequest("/api/supervisor/qa"))).status).toBe(403);
  });
});

describe("supervisor reads", () => {
  beforeEach(async () => {
    await signInAs("SUPERVISOR");
  });

  it("returns the dashboard in one response", async () => {
    const body = await (await GET_OVERVIEW()).json();

    expect(body.kpis.length).toBeGreaterThan(0);
    expect(body.snapshot).toBeDefined();
    expect(body.roster.length).toBeGreaterThan(0);
    expect(body.escalations).toBeDefined();
    expect(body.qa).toBeDefined();
  });

  it("returns paged queue rows with filter options", async () => {
    const response = await GET_QUEUE(getRequest("/api/supervisor/queue?pageSize=5"));
    const body = await response.json();

    expect(body.page.items.length).toBeLessThanOrEqual(5);
    expect(body.options.assignees.length).toBeGreaterThan(0);
    expect(body.roster.length).toBeGreaterThan(0);
  });

  it("rejects an unknown filter value", async () => {
    const response = await GET_QUEUE(getRequest("/api/supervisor/queue?status=nonsense"));
    expect(response.status).toBe(400);
  });

  it("serialises every date in a queue row as an ISO string", async () => {
    const body = await (await GET_QUEUE(getRequest("/api/supervisor/queue?pageSize=1"))).json();
    const row = body.page.items[0];

    expect(typeof row.receivedAt).toBe("string");
    expect(typeof row.sla.deadline).toBe("string");
    expect(new Date(row.sla.deadline).toISOString()).toBe(row.sla.deadline);
  });

  it("returns team workload and SLA figures", async () => {
    const team = await (await GET_TEAM(getRequest("/api/supervisor/team"))).json();
    expect(team.workloads.length).toBeGreaterThan(0);
    expect(team.summary.total).toBe(team.workloads.length);

    const sla = await (await GET_SLA()).json();
    expect(sla.counts).toBeDefined();
    expect(sla.note).toBeTruthy();
  });

  it("returns the audit trail newest first and filters by type", async () => {
    const all = await (await GET_AUDIT(getRequest("/api/supervisor/audit?pageSize=200"))).json();
    expect(all.items.length).toBeGreaterThan(0);

    const filtered = await (
      await GET_AUDIT(getRequest("/api/supervisor/audit?type=escalated&pageSize=200"))
    ).json();
    expect(filtered.items.every((row: { type: string }) => row.type === "escalated")).toBe(true);
  });

  it("returns a capability map with every console capability granted", async () => {
    const body = await (await GET_PERMISSIONS()).json();

    expect(body.role).toBe("SUPERVISOR");
    expect(body.granted).toBe(body.total);
    expect(body.groups.length).toBeGreaterThan(0);
  });
});

describe("supervisor mutations", () => {
  beforeEach(async () => {
    await signInAs("SUPERVISOR");
  });

  it("rejects a priority change for an agent", async () => {
    await signInAs("AGENT");
    const body = await (await GET_QUEUE(getRequest("/api/supervisor/queue?pageSize=1"))).json();
    expect(body).toBeDefined();
    await signInAs("SUPERVISOR");
  });

  it("changes priority and records an audit event", async () => {
    const queue = await (await GET_QUEUE(getRequest("/api/supervisor/queue?status=active&pageSize=1"))).json();
    const row = queue.page.items[0];
    const target = row.priority === "critical" ? "low" : "critical";

    const response = await PATCH_PRIORITY(
      patchRequest(`/api/conversations/${row.id}/priority`, { priority: target, reason: "API test" }),
      idContext(row.id),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conversation.priority).toBe(target);
    expect(body.event.type).toBe("priority_changed");
  });

  it("reports 409 when the priority is unchanged", async () => {
    const queue = await (await GET_QUEUE(getRequest("/api/supervisor/queue?pageSize=1"))).json();
    const row = queue.page.items[0];

    const response = await PATCH_PRIORITY(
      patchRequest(`/api/conversations/${row.id}/priority`, { priority: row.priority }),
      idContext(row.id),
    );

    expect(response.status).toBe(409);
  });

  it("denies a priority change to an agent", async () => {
    const queue = await (await GET_QUEUE(getRequest("/api/supervisor/queue?pageSize=1"))).json();
    const row = queue.page.items[0];
    await signInAs("AGENT");

    const response = await PATCH_PRIORITY(
      patchRequest(`/api/conversations/${row.id}/priority`, { priority: "critical" }),
      idContext(row.id),
    );

    expect(response.status).toBe(403);
  });

  it("resolves an escalation and removes it from the open board", async () => {
    const id = await escalatedId();
    expect(id).not.toBeNull();
    if (!id) return;

    const response = await POST_RESOLVE(
      postRequest(`/api/supervisor/escalations/${id}/resolve`, { outcome: "resolved", note: "Handled" }),
      idContext(id),
    );
    expect(response.status).toBe(200);

    const after = await (await GET_ESCALATIONS(getRequest("/api/supervisor/escalations?filter=open"))).json();
    expect(after.rows.some((row: { conversationId: string }) => row.conversationId === id)).toBe(false);
  });

  it("returns 409 when the conversation is not escalated", async () => {
    const queue = await (await GET_QUEUE(getRequest("/api/supervisor/queue?status=open&pageSize=1"))).json();
    const row = queue.page.items[0];

    const response = await POST_RESOLVE(
      postRequest(`/api/supervisor/escalations/${row.id}/resolve`, { outcome: "dismissed" }),
      idContext(row.id),
    );

    expect(response.status).toBe(409);
  });

  it("rejects a QA approval that skips a mandatory check", async () => {
    const id = await qaId();
    expect(id).not.toBeNull();
    if (!id) return;

    const response = await POST_QA(
      postRequest(`/api/supervisor/qa/${id}`, { checks: { tone: "pass" }, status: "approved" }),
      idContext(id),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_review");
    expect(Object.keys(body.errors)).toEqual(expect.arrayContaining(["accuracy", "privacy"]));
  });

  it("approves a complete QA review and clears the flag", async () => {
    const id = await qaId();
    expect(id).not.toBeNull();
    if (!id) return;

    const response = await POST_QA(
      postRequest(`/api/supervisor/qa/${id}`, {
        checks: { accuracy: "pass", tone: "pass", privacy: "pass", compliance: "not_applicable" },
        status: "approved",
      }),
      idContext(id),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.row.status).toBe("approved");
    expect(body.event.type).toBe("qa_reviewed");
  });

  it("denies a QA decision to a role without the review permission", async () => {
    const id = await qaId();
    if (!id) return;
    // QA holds qa.view but not supervisor.qa.review.
    await signInAs("QA");

    const response = await POST_QA(
      postRequest(`/api/supervisor/qa/${id}`, {
        checks: { accuracy: "pass", tone: "pass", privacy: "pass" },
        status: "approved",
      }),
      idContext(id),
    );

    expect(response.status).toBe(403);
  });

  it("accepts a claim without judging the review", async () => {
    const id = await qaId();
    expect(id).not.toBeNull();
    if (!id) return;

    const response = await POST_QA(
      postRequest(`/api/supervisor/qa/${id}`, { checks: {}, status: "in_review" }),
      idContext(id),
    );

    expect(response.status).toBe(204);
  });
});
