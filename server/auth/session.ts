import { jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";

import { isProduction, getServerEnv } from "@/lib/env";
import { ROLES, type Role, type Session, type UserProfile } from "@/lib/domain/user";

/**
 * Session management.
 *
 * Sessions are signed, HttpOnly, same-site cookies containing a compact JWT
 * (HS256). Phase 3 consumes sessions for the authenticated application shell;
 * Phase 4 builds the login/demo flows on top. Phase 5 adds a server-side store
 * so sessions can be revoked centrally.
 *
 * Security notes:
 *  - The browser only ever holds a signed token; identity data is re-verified
 *    from it on every read.
 *  - The secret is taken from SESSION_SECRET. Production refuses to boot
 *    without one (see lib/env.ts). A fallback key exists for development/test
 *    only and is explicitly never used in production.
 */

export const SESSION_COOKIE = "senami_session";

const SESSION_ISSUER = "senami";
const SESSION_AUDIENCE = "senami:web";

/** Development/test-only fallback. Banned in production by an explicit branch. */
const DEV_ONLY_SESSION_SECRET = "senami-dev-only-session-secret-change-me-00000000000000";

const JWT_ALGORITHM = "HS256";

interface SessionPayload {
  readonly sid: string;
  readonly uid: string;
  readonly role: Role;
  readonly name: string;
  readonly email: string;
  readonly teamId: string | null;
}

function secretString(): string {
  const env = getServerEnv();
  if (isProduction()) {
    // Env validation guarantees this is present in production.
    return env.SESSION_SECRET as string;
  }
  return env.SESSION_SECRET ?? DEV_ONLY_SESSION_SECRET;
}

/**
 * The signing key as a webcrypto `CryptoKey`. jose's browser build does not
 * accept raw keys for HMAC, and the Node build accepts both, so importing a
 * `CryptoKey` once makes signing identical across runtimes. Cached per secret
 * so concurrent requests share one import.
 */
const keyCache = new Map<string, Promise<CryptoKey>>();

export function getSessionKey(): Promise<CryptoKey> {
  const secret = secretString();
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle
      .importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
      )
      .catch((cause: unknown) => {
        keyCache.delete(secret);
        throw cause;
      });
    keyCache.set(secret, key);
  }
  return key;
}

/** Build a session record for a user, with a fresh identifier and expiry. */
export function buildSession(user: UserProfile): Session {
  return {
    id: randomUUID(),
    user,
    expiresAt: Date.now() + getServerEnv().SESSION_TTL_SECONDS * 1_000,
  };
}

/** Sign a session into a cookie value. Separated from cookie I/O for tests. */
export async function signSession(session: Session): Promise<string> {
  return new SignJWT({
    sid: session.id,
    uid: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    teamId: session.user.teamId,
  } satisfies SessionPayload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(session.user.id)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(session.expiresAt / 1_000))
    .sign(await getSessionKey());
}

/** The max-age of the session cookie, in seconds. */
export function sessionCookieMaxAge(): number {
  return getServerEnv().SESSION_TTL_SECONDS;
}

export function sessionCookieAttributes(): {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "strict";
  readonly path: "/";
  readonly maxAge: number;
} {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge: sessionCookieMaxAge(),
  };
}

export class ExpiredSessionError extends Error {
  override readonly name = "ExpiredSessionError";
}

export class InvalidSessionError extends Error {
  override readonly name = "InvalidSessionError";
}

/**
 * Verify a cookie value into a session. Throws ExpiredSessionError for expired
 * tokens and InvalidSessionError for anything malformed/forged. Pure so tests
 * can run without a request context.
 */
export async function verifySession(cookieValue: string): Promise<Session> {
  let payload: SessionPayload;
  try {
    const { payload: verified } = await jwtVerify(cookieValue, await getSessionKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    payload = verified as unknown as SessionPayload;
  } catch (error) {
    if (error instanceof Error && error.name === "JWTExpired") {
      throw new ExpiredSessionError("Session expired.", { cause: error });
    }
    throw new InvalidSessionError("Session signature or claims are invalid.", { cause: error });
  }

  if (typeof payload.sid !== "string" || typeof payload.uid !== "string") {
    throw new InvalidSessionError("Session payload is missing required claims.");
  }
  if (!ROLES.includes(payload.role)) {
    throw new InvalidSessionError("Session payload carries an unknown role.");
  }

  const expiresAt = (payload as { exp?: number }).exp;
  if (typeof expiresAt !== "number") {
    throw new InvalidSessionError("Session payload has no expiry.");
  }

  return {
    id: payload.sid,
    expiresAt: expiresAt * 1_000,
    user: {
      id: payload.uid,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      teamId: payload.teamId ?? null,
      initials: payload.name.trim().slice(0, 2).toUpperCase(),
    },
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
