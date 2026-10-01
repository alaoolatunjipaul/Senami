import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { resetServerEnvCache } from "@/lib/env";
import { SESSION_COOKIE, buildSession, signSession } from "@/server/auth/session";
import { demoAccountForRole, profileFromAccount } from "@/server/auth/demo-users";
import { resetDemoInboxStore } from "@/server/inbox/store";
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

import { GET } from "@/app/api/conversations/route";
import { GET as GET_ONE } from "@/app/api/conversations/[id]/route";
import { POST as POST_READ } from "@/app/api/conversations/[id]/read/route";

async function signInAs(role: Role): Promise<void> {
  const account = demoAccountForRole(role);
  if (!account) throw new Error(`no demo account for ${role}`);
  const token = await signSession(buildSession(profileFromAccount(account)));
  cookieStore.set(SESSION_COOKIE, token);
}

function listRequest(search = ""): NextRequest {
  return new NextRequest(`http://localhost/api/conversations${search}`);
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  cookieStore.clear();
  resetDemoInboxStore();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SESSION_SECRET", "test-only-session-secret-with-at-least-32-chars");
  resetServerEnvCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/conversations", () => {
  it("rejects anonymous callers", async () => {
    const response = await GET(listRequest());
    expect(response.status).toBe(401);
  });

  it("returns the first page, total and filter options for an agent", async () => {
    await signInAs("AGENT");
    const response = await GET(listRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.total).toBe(128);
    expect(body.items).toHaveLength(25);
    expect(body.page).toBe(1);
    expect(body.options.channels.length).toBeGreaterThan(0);
    expect(body.options.assignees.length).toBeGreaterThan(0);
    expect(typeof body.items[0].receivedAt).toBe("string");
  });

  it("applies intent and channel filters from the query string", async () => {
    await signInAs("AGENT");

    const byIntent = await GET(listRequest("?intent=card_issue&pageSize=100"));
    const intentBody = await byIntent.json();
    expect(intentBody.total).toBeGreaterThan(0);
    expect(intentBody.items.every((item: { intent: string }) => item.intent === "card_issue")).toBe(true);

    const byChannel = await GET(listRequest("?channel=instagram&channel=tiktok&pageSize=100"));
    const channelBody = await byChannel.json();
    expect(channelBody.total).toBeGreaterThan(0);
    expect(
      channelBody.items.every(
        (item: { channel: string }) => item.channel === "instagram" || item.channel === "tiktok",
      ),
    ).toBe(true);
  });

  it("scopes the assigned view to the signed-in user", async () => {
    await signInAs("AGENT");
    const response = await GET(listRequest("?view=assigned&pageSize=100"));
    const body = await response.json();
    expect(body.total).toBeGreaterThan(0);
    expect(
      body.items.every((item: { assignedTo: { id: string } | null }) => item.assignedTo?.id === "usr_agent_maya"),
    ).toBe(true);
  });

  it("rejects invalid query parameters", async () => {
    await signInAs("AGENT");
    expect((await GET(listRequest("?channel=myspace"))).status).toBe(400);
    expect((await GET(listRequest("?page=0"))).status).toBe(400);
    expect((await GET(listRequest("?intent=teleport"))).status).toBe(400);
  });
});

describe("GET /api/conversations/:id", () => {
  it("requires authentication", async () => {
    expect((await GET_ONE(new NextRequest("http://localhost/api/conversations/cv_0001"), idContext("cv_0001"))).status).toBe(401);
  });

  it("returns a conversation and 404s for unknown ids", async () => {
    await signInAs("AGENT");
    const found = await GET_ONE(new NextRequest("http://localhost/api/conversations/cv_0001"), idContext("cv_0001"));
    expect(found.status).toBe(200);
    const body = await found.json();
    expect(body.conversation.id).toBe("cv_0001");

    const missing = await GET_ONE(new NextRequest("http://localhost/api/conversations/cv_9999"), idContext("cv_9999"));
    expect(missing.status).toBe(404);
  });
});

describe("POST /api/conversations/:id/read", () => {
  function readRequest(id: string, body: unknown): NextRequest {
    return new NextRequest(`http://localhost/api/conversations/${id}/read`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("sets the read state and reflects it in the store", async () => {
    await signInAs("AGENT");
    const list = await GET(listRequest("?pageSize=100"));
    const item = (await list.json()).items.find((candidate: { unread: boolean }) => candidate.unread);
    expect(item).toBeTruthy();

    const marked = await POST_READ(readRequest(item.id, { read: true }), idContext(item.id));
    expect(marked.status).toBe(200);
    expect((await marked.json()).conversation.unread).toBe(false);

    const unread = await POST_READ(readRequest(item.id, { read: false }), idContext(item.id));
    expect((await unread.json()).conversation.unread).toBe(true);
  });

  it("validates the body and handles unknown ids", async () => {
    await signInAs("AGENT");
    expect((await POST_READ(readRequest("cv_0001", { read: "yes" }), idContext("cv_0001"))).status).toBe(400);
    expect((await POST_READ(readRequest("cv_0001", "not json"), idContext("cv_0001"))).status).toBe(400);
    expect((await POST_READ(readRequest("cv_9999", { read: true }), idContext("cv_9999"))).status).toBe(404);
  });

  it("requires authentication", async () => {
    expect((await POST_READ(readRequest("cv_0001", { read: true }), idContext("cv_0001"))).status).toBe(401);
  });
});