import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetServerEnvCache } from "@/lib/env";
import {
  buildSession,
  ExpiredSessionError,
  InvalidSessionError,
  signSession,
  verifySession,
} from "@/server/auth/session";
import { deriveInitials, type UserProfile } from "@/lib/domain/user";

const user: UserProfile = {
  id: "user_1",
  name: "Maya Keller",
  email: "maya@senami.test",
  role: "AGENT",
  teamId: null,
  initials: deriveInitials("Maya Keller"),
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SESSION_SECRET", "test-only-session-secret-with-at-least-32-chars");
  resetServerEnvCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sessions", () => {
  it("signs and verifies a session round trip", async () => {
    const session = buildSession(user);
    const token = await signSession(session);

    const verified = await verifySession(token);

    expect(verified.id).toBe(session.id);
    expect(verified.user.role).toBe("AGENT");
    expect(verified.user.name).toBe("Maya Keller");
    expect(verified.user.email).toBe("maya@senami.test");
    expect(verified.user.teamId).toBeNull();
    expect(verified.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects a tampered token", async () => {
    const token = await signSession(buildSession(user));
    const flipped = token.slice(0, 20) + (token[20] === "A" ? "B" : "A") + token.slice(21);

    await expect(verifySession(flipped)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("rejects garbage rather than throwing a raw jwt error", async () => {
    await expect(verifySession("not.a.jwt")).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("rejects an expired token as ExpiredSessionError", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-09-01T09:00:00.000Z"));

    const session = buildSession(user);
    const token = await signSession(session);

    vi.setSystemTime(session.expiresAt + 1_000);
    await expect(verifySession(token)).rejects.toBeInstanceOf(ExpiredSessionError);
  });

  it("creates sessions with a unique identifier per issue", async () => {
    const first = buildSession(user);
    const second = buildSession(user);

    expect(first.id).not.toBe(second.id);
  });
});
