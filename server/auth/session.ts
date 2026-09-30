import { randomUUID } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import type { Session, UserProfile } from "@/lib/domain/user";
import {
  SESSION_COOKIE,
  sessionCookieAttributes,
  signSession,
  verifySession,
  ExpiredSessionError,
  InvalidSessionError,
} from "@/server/auth/session-cookie";

export {
  SESSION_COOKIE,
  sessionCookieAttributes,
  signSession,
  verifySession,
  ExpiredSessionError,
  InvalidSessionError,
};

/**
 * Session lifecycle - server components only.
 *
 * `server/auth/session-cookie.ts` owns signing/verifying the token; this module
 * adds the server-only parts: session identity generation and reading/writing
 * the session cookie through the Request/Response cookie store. Keep these two
 * apart so middleware can verify cookies without importing Node-only code.
 */

/** Build a session record for a user, with a fresh identifier and expiry. */
export function buildSession(user: UserProfile): Session {
  return {
    id: randomUUID(),
    user,
    expiresAt: Date.now() + getServerEnv().SESSION_TTL_SECONDS * 1_000,
  };
}

/**
 * Read the current session from the request cookies. Server components only.
 * Returns null when there is no cookie, it is malformed, or it has expired.
 */
export async function getSessionFromCookies(): Promise<Session | null> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

/** Convenience: the current user identity, or null when signed out. */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const session = await getSessionFromCookies();
  return session?.user ?? null;
}