/**
 * Runtime verification against a running dev server.
 *
 * Not part of the shipped application or the unit suite: it drives the real HTTP
 * surface (middleware, RBAC, API handlers) using a session cookie minted with the
 * application's own signing code, so the interaction history is verified end to
 * end rather than inferred from source.
 *
 * Run with the dev server up:  node_modules/vitest/vitest.mjs run e2e/runtime.verify.test.ts
 */
import { describe, expect, it } from "vitest";

import { demoAccountForRole } from "@/server/auth/demo-users";
import { buildSession } from "@/server/auth/session";
import { SESSION_COOKIE, signSession } from "@/server/auth/session-cookie";

// Next.js predefines `BASE_URL` as an empty string, so read a Senami-specific
// variable and fall back when it is blank.
const BASE = process.env.SENAMI_BASE_URL?.trim() || "http://localhost:3000";

async function cookieFor(role: "AGENT" | "SUPERVISOR" | "QA" | "ADMIN"): Promise<string> {
  const account = demoAccountForRole(role);
  if (account === null) throw new Error(`No demo account for ${role}`);
  const session = buildSession({
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    teamId: account.teamId,
    initials: account.name.slice(0, 2).toUpperCase(),
  });
  return `${SESSION_COOKIE}=${await signSession(session)}`;
}

async function html(path: string, cookie: string) {
  const response = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  return { status: response.status, body: await response.text() };
}

async function json<T = any>(path: string, cookie: string) {
  const response = await fetch(`${BASE}${path}`, { headers: { cookie } });
  return { status: response.status, body: (await response.json()) as T };
}

describe("runtime: agent interaction history", () => {
  it("walks the whole agent flow over real HTTP", async () => {
    const agent = await cookieFor("AGENT");

    // 1-3: workspace and interaction list
    const dashboard = await html("/dashboard", agent);
    expect(dashboard.status).toBe(200);

    const list = await json("/api/conversations?pageSize=100", agent);
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThan(0);

    const first = list.body.items[0];
    expect(first.interactionId).toMatch(/^INT-SOC-\d{8}-\d{5}$/);

    // 4: search by interaction ID
    const byId = await json(
      `/api/conversations?q=${encodeURIComponent(first.interactionId)}&pageSize=100`,
      agent,
    );
    expect(byId.body.total).toBe(1);
    expect(byId.body.items[0].id).toBe(first.id);

    // 5: search by social handle
    const byHandle = await json(
      `/api/conversations?q=${encodeURIComponent(first.customer.handle)}&pageSize=100`,
      agent,
    );
    expect(byHandle.body.total).toBeGreaterThan(0);
    expect(
      byHandle.body.items.every((item: any) => item.customer.handle === first.customer.handle),
    ).toBe(true);

    // 6-7: open the interaction; the reference travels with the payload the
    // client renders. (The list and workspace are client-rendered, so server
    // HTML only carries loading placeholders - DOM rendering is covered by the
    // jsdom UI tests and this asserts the data contract end to end.)
    const detail = await json(`/api/conversations/${first.id}`, agent);
    expect(detail.status).toBe(200);
    expect(detail.body.conversation.id).toBe(first.id);
    expect(detail.body.conversation.interactionId).toBe(first.interactionId);

    const workspace = await html(`/inbox?conversation=${first.id}`, agent);
    expect(workspace.status).toBe(200);
    expect(workspace.body).toContain("Inbox");
    expect(workspace.body).not.toContain("Application error");

    // 8-9: customer history with references, and a previous interaction opens
    const history = await json(`/api/conversations/${first.id}/history`, agent);
    expect(history.status).toBe(200);
    expect(history.body.recent.length).toBeGreaterThan(0);
    for (const row of history.body.recent) {
      expect(row.interactionId).toMatch(/^INT-SOC-/);
      expect(row.assignedTo === null || typeof row.assignedTo.name === "string").toBe(true);
    }

    const previous = history.body.recent.find((row: any) => row.id !== first.id);
    if (previous) {
      const opened = await json(`/api/conversations/${previous.id}`, agent);
      expect(opened.body.conversation.id).toBe(previous.id);
    }

    // 10-13: an arbitrary calendar day filters; clearing restores everything.
    // ISO days are resolved at local midnight, so mirror that here.
    const day = new Date(first.receivedAt);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const dayStart = new Date(`${iso}T00:00:00.000`);
    const dayEnd = new Date(`${iso}T00:00:00.000`);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const scoped = await json(
      `/api/conversations?date=custom&from=${iso}&to=${iso}&pageSize=100`,
      agent,
    );
    expect(scoped.status).toBe(200);
    expect(scoped.body.total).toBeGreaterThan(0);
    expect(scoped.body.total).toBeLessThan(list.body.total);
    for (const item of scoped.body.items) {
      expect(new Date(item.receivedAt).getTime()).toBeLessThan(dayEnd.getTime());
      expect(new Date(item.lastMessageAt).getTime()).toBeGreaterThanOrEqual(dayStart.getTime());
    }

    // Every returned interaction must actually belong to the selected day.
    const adjacent = new Date(dayStart);
    adjacent.setDate(adjacent.getDate() - 1);
    const previousIso = `${adjacent.getFullYear()}-${String(adjacent.getMonth() + 1).padStart(2, "0")}-${String(adjacent.getDate()).padStart(2, "0")}`;
    const previousDay = await json(
      `/api/conversations?date=custom&from=${previousIso}&to=${previousIso}&pageSize=100`,
      agent,
    );
    const previousIds = new Set(previousDay.body.items.map((item: any) => item.id));
    for (const item of scoped.body.items) {
      if (new Date(item.receivedAt).getTime() >= dayStart.getTime()) continue;
      // Only an overlap may carry over from the previous day, and only if it
      // was still being answered on the selected day.
      expect(previousIds.has(item.id)).toBe(true);
      expect(new Date(item.lastMessageAt).getTime()).toBeGreaterThanOrEqual(dayStart.getTime());
    }

    const unusedDay = await json(
      "/api/conversations?date=custom&from=2001-01-01&to=2001-01-01&pageSize=100",
      agent,
    );
    expect(unusedDay.body.total).toBe(0);

    const cleared = await json("/api/conversations?pageSize=100", agent);
    expect(cleared.body.total).toBe(list.body.total);
  }, 60_000);
});

describe("runtime: role workspace labels", () => {
  it("never shows a supervisor the agent workspace label", async () => {
    const supervisor = await cookieFor("SUPERVISOR");
    const queue = await html("/supervisor/queue", supervisor);
    expect(queue.status).toBe(200);
    expect(queue.body).toContain("Supervisor workspace");
    expect(queue.body).not.toContain("Agent workspace");

    const agent = await cookieFor("AGENT");
    const dashboard = await html("/dashboard", agent);
    expect(dashboard.body).toContain("Agent workspace");

    const qa = await cookieFor("QA");
    const qaPage = await html("/dashboard", qa);
    expect(qaPage.body).toContain("QA workspace");

    const admin = await cookieFor("ADMIN");
    const adminPage = await html("/supervisor", admin);
    expect(adminPage.body).toContain("Admin workspace");
  }, 60_000);
});