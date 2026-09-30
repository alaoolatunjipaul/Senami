import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE, verifySession } from "@/server/auth/session";
import { resetServerEnvCache } from "@/lib/env";

class NextRedirectError extends Error {
  constructor(readonly url: string) {
    super("NEXT_REDIRECT");
    this.name = "NEXT_REDIRECT";
  }
}

const cookieStore = new Map<string, string>();
const cookieWrites: Array<[string, string, Record<string, unknown>]> = [];

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieStore.set(name, value);
      cookieWrites.push([name, value, options ?? {}]);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new NextRedirectError(url);
  },
}));

import { loginAsDemoUser, logoutAction } from "@/server/auth/actions";

beforeEach(() => {
  cookieStore.clear();
  cookieWrites.length = 0;
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SESSION_SECRET", "test-only-session-secret-with-at-least-32-chars");
  resetServerEnvCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function expectRedirect(action: () => Promise<void>) {
  await expect(action()).rejects.toEqual(expect.any(NextRedirectError));
}

describe("authentication actions", () => {
  it("signs a strict HttpOnly cookie for the picked demo role and goes to the inbox", async () => {
    await expectRedirect(() => loginAsDemoUser("SUPERVISOR", new FormData()));

    const token = cookieStore.get(SESSION_COOKIE);
    expect(token).toBeTruthy();

    const verified = await verifySession(token as string);
    expect(verified.user.role).toBe("SUPERVISOR");
    expect(verified.user.name).toBe("David Okoro");

    const [name, , attributes] = cookieWrites[0] as [string, string, Record<string, unknown>];
    expect(name).toBe(SESSION_COOKIE);
    expect(attributes).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
  });

  it("rejects an unknown role by abandoning the login", async () => {
    await expectRedirect(() => loginAsDemoUser("ROOT", new FormData()));
    expect(cookieStore.has(SESSION_COOKIE)).toBe(false);
  });

  it("signs the QA account with a distinct identity", async () => {
    await expectRedirect(() => loginAsDemoUser("QA", new FormData()));
    const verified = await verifySession(cookieStore.get(SESSION_COOKIE) as string);
    expect(verified.user.role).toBe("QA");
    expect(verified.user.email).toBe("amara.osei@senami.demo");
  });

  it("clears the session cookie on logout and returns to login", async () => {
    await expectRedirect(() => loginAsDemoUser("AGENT", new FormData()));
    expect(cookieStore.has(SESSION_COOKIE)).toBe(true);

    await expectRedirect(() => logoutAction());
    expect(cookieStore.has(SESSION_COOKIE)).toBe(false);
  });
});