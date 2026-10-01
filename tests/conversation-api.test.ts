import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { resetServerEnvCache } from "@/lib/env";
import { DEFAULT_INBOX_QUERY } from "@/lib/domain/inbox";
import { SESSION_COOKIE, buildSession, signSession } from "@/server/auth/session";
import { demoAccountForRole, profileFromAccount } from "@/server/auth/demo-users";
import { demoConversationStore, resetDemoConversationStore } from "@/server/conversations/store";
import { demoInboxStore } from "@/server/inbox/store";
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

import { GET as GET_MESSAGES, POST as POST_MESSAGE } from "@/app/api/conversations/[id]/messages/route";
import { GET as GET_AUDIT } from "@/app/api/conversations/[id]/audit/route";
import { GET as GET_HISTORY } from "@/app/api/conversations/[id]/history/route";
import { POST as POST_ASSIGN } from "@/app/api/conversations/[id]/assign/route";
import { POST as POST_ESCALATE } from "@/app/api/conversations/[id]/escalate/route";
import { POST as POST_MOVE } from "@/app/api/conversations/[id]/move-to-private/route";
import { GET as GET_ONE } from "@/app/api/conversations/[id]/route";

async function signInAs(role: Role): Promise<void> {
  const account = demoAccountForRole(role);
  if (!account) throw new Error(`no demo account for ${role}`);
  const token = await signSession(buildSession(profileFromAccount(account)));
  cookieStore.set(SESSION_COOKIE, token);
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function messageRequest(id: string, body: unknown): NextRequest {
  return postRequest(`/api/conversations/${id}/messages`, body);
}

function findUnassignedId(): string {
  const items = demoInboxStore().list({ ...DEFAULT_INBOX_QUERY, pageSize: 200 }).items;
  const found = items.find((item) => item.assignedTo === null);
  if (!found) throw new Error("seed has no unassigned conversation");
  return found.id;
}

function findPublicId(): string {
  const items = demoInboxStore().list({ ...DEFAULT_INBOX_QUERY, pageSize: 200 }).items;
  for (const item of items) {
    const info = demoConversationStore().threadInfo(item.id);
    if (info?.type === "public" && info.movedToConversationId === null) return item.id;
  }
  throw new Error("seed has no public conversation");
}

beforeEach(() => {
  cookieStore.clear();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SESSION_SECRET", "test-only-session-secret-with-at-least-32-chars");
  resetServerEnvCache();
  resetDemoConversationStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/conversations/:id (detail with thread)", () => {
  it("returns the conversation and thread metadata", async () => {
    await signInAs("AGENT");
    const response = await GET_ONE(
      new NextRequest("http://localhost/api/conversations/cv_0001"),
      idContext("cv_0001"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conversation.id).toBe("cv_0001");
    expect(["public", "private"]).toContain(body.thread.type);
    expect(body.thread.assignees.length).toBeGreaterThan(0);
  });
});

describe("GET /api/conversations/:id/messages", () => {
  it("requires authentication and 404s for unknown ids", async () => {
    expect(
      (await GET_MESSAGES(new NextRequest("http://localhost/x"), idContext("cv_0001"))).status,
    ).toBe(401);

    await signInAs("AGENT");
    const missing = await GET_MESSAGES(
      new NextRequest("http://localhost/x"),
      idContext("cv_9999"),
    );
    expect(missing.status).toBe(404);
  });

  it("returns the timeline for a signed-in agent", async () => {
    await signInAs("AGENT");
    const response = await GET_MESSAGES(new NextRequest("http://localhost/x"), idContext("cv_0001"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.messages.length).toBeGreaterThan(0);
    expect(body.messages[0].conversationId).toBe("cv_0001");
    expect(typeof body.messages[0].createdAt).toBe("string");
  });
});

describe("POST /api/conversations/:id/messages", () => {
  it("requires authentication and reply permission", async () => {
    expect(
      (await POST_MESSAGE(messageRequest("cv_0001", { kind: "public", body: "hi" }), idContext("cv_0001")))
        .status,
    ).toBe(401);

    await signInAs("QA");
    const forbidden = await POST_MESSAGE(
      messageRequest("cv_0001", { kind: "public", body: "hi" }),
      idContext("cv_0001"),
    );
    expect(forbidden.status).toBe(403);
  });

  it("rejects malformed bodies, system kinds and empty content", async () => {
    await signInAs("AGENT");
    expect(
      (await POST_MESSAGE(messageRequest("cv_0001", "not json"), idContext("cv_0001"))).status,
    ).toBe(400);
    expect(
      (await POST_MESSAGE(messageRequest("cv_0001", { kind: "system", body: "x" }), idContext("cv_0001")))
        .status,
    ).toBe(400);
    expect(
      (await POST_MESSAGE(messageRequest("cv_0001", { kind: "public", body: "   " }), idContext("cv_0001")))
        .status,
    ).toBe(400);
  });

  it("sends a public reply and reflects it on the conversation", async () => {
    await signInAs("AGENT");
    const response = await POST_MESSAGE(
      messageRequest("cv_0001", { kind: "public", body: "Thanks for your patience." }),
      idContext("cv_0001"),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.message.kind).toBe("public");
    expect(body.conversation.preview).toBe("Thanks for your patience.");
  });

  it("records an internal note without changing the customer-facing preview", async () => {
    await signInAs("AGENT");
    const before = demoInboxStore().getById("cv_0001")?.preview;

    const response = await POST_MESSAGE(
      messageRequest("cv_0001", { kind: "internal_note", body: "Internal: payments investigating." }),
      idContext("cv_0001"),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.message.kind).toBe("internal_note");
    expect(body.conversation.preview).toBe(before);
  });

  it("404s for unknown conversations", async () => {
    await signInAs("AGENT");
    const response = await POST_MESSAGE(
      messageRequest("cv_9999", { kind: "public", body: "hello" }),
      idContext("cv_9999"),
    );
    expect(response.status).toBe(404);
  });
});

describe("GET /api/conversations/:id/audit", () => {
  it("returns the audit trail and 404s for unknown ids", async () => {
    await signInAs("AGENT");
    const response = await GET_AUDIT(new NextRequest("http://localhost/x"), idContext("cv_0001"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events.length).toBeGreaterThan(0);

    expect(
      (await GET_AUDIT(new NextRequest("http://localhost/x"), idContext("cv_9999"))).status,
    ).toBe(404);
  });

  it("requires authentication", async () => {
    expect(
      (await GET_AUDIT(new NextRequest("http://localhost/x"), idContext("cv_0001"))).status,
    ).toBe(401);
  });
});

describe("GET /api/conversations/:id/history", () => {
  it("returns customer history", async () => {
    await signInAs("AGENT");
    const response = await GET_HISTORY(new NextRequest("http://localhost/x"), idContext("cv_0001"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.customer.id).toBeTruthy();
    expect(body.totalConversations).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.recent)).toBe(true);
  });
});

describe("POST /api/conversations/:id/assign", () => {
  it("lets an agent claim an unassigned conversation", async () => {
    await signInAs("AGENT");
    const id = findUnassignedId();
    const response = await POST_ASSIGN(
      postRequest(`/api/conversations/${id}/assign`, { assigneeId: "usr_agent_kai" }),
      idContext(id),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conversation.assignedTo.id).toBe("usr_agent_kai");
    expect(body.event.type).toBe("assigned");
  });

  it("stops an agent taking a conversation from another agent, but a supervisor may", async () => {
    await signInAs("AGENT");
    const id = findUnassignedId();
    await POST_ASSIGN(
      postRequest(`/api/conversations/${id}/assign`, { assigneeId: "usr_agent_kai" }),
      idContext(id),
    );

    const denied = await POST_ASSIGN(
      postRequest(`/api/conversations/${id}/assign`, { assigneeId: "usr_agent_maya" }),
      idContext(id),
    );
    expect(denied.status).toBe(403);

    await signInAs("SUPERVISOR");
    const allowed = await POST_ASSIGN(
      postRequest(`/api/conversations/${id}/assign`, { assigneeId: "usr_agent_maya" }),
      idContext(id),
    );
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).conversation.assignedTo.id).toBe("usr_agent_maya");
  });

  it("rejects an unknown assignee", async () => {
    await signInAs("AGENT");
    const id = findUnassignedId();
    const response = await POST_ASSIGN(
      postRequest(`/api/conversations/${id}/assign`, { assigneeId: "usr_nobody" }),
      idContext(id),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/conversations/:id/escalate", () => {
  it("escalates for an agent and forbids QA", async () => {
    await signInAs("QA");
    expect(
      (
        await POST_ESCALATE(
          postRequest("/api/conversations/cv_0001/escalate", { reason: "complex_case" }),
          idContext("cv_0001"),
        )
      ).status,
    ).toBe(403);

    await signInAs("AGENT");
    const response = await POST_ESCALATE(
      postRequest("/api/conversations/cv_0001/escalate", {
        reason: "fraud_risk",
        note: "Possible takeover.",
      }),
      idContext("cv_0001"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conversation.status).toBe("escalated");
    expect(body.event.type).toBe("escalated");
  });

  it("validates the reason", async () => {
    await signInAs("AGENT");
    const response = await POST_ESCALATE(
      postRequest("/api/conversations/cv_0001/escalate", { reason: "because" }),
      idContext("cv_0001"),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/conversations/:id/move-to-private", () => {
  it("creates a linked private conversation and rejects a repeat move", async () => {
    await signInAs("AGENT");
    const id = findPublicId();

    const response = await POST_MOVE(
      postRequest(`/api/conversations/${id}/move-to-private`, {
        reason: "Sharing account details",
        greeting: "Hi, moving this to a private message.",
      }),
      idContext(id),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.created.id).toBe("cv_dm_0001");
    expect(body.event.type).toBe("moved_to_private");

    const repeat = await POST_MOVE(
      postRequest(`/api/conversations/${id}/move-to-private`, { reason: "again" }),
      idContext(id),
    );
    expect(repeat.status).toBe(409);
  });

  it("requires a reason", async () => {
    await signInAs("AGENT");
    const id = findPublicId();
    const response = await POST_MOVE(
      postRequest(`/api/conversations/${id}/move-to-private`, { greeting: "hi" }),
      idContext(id),
    );
    expect(response.status).toBe(400);
  });
});
