import { jwtVerify, SignJWT } from "jose";

import { getServerEnv, isProduction } from "@/lib/env";
import { ROLES } from "@/lib/domain/user";
import type { Role, Session, UserProfile } from "@/lib/domain/user";

/**
 * Signed session cookie - the browser-facing half of sessions.
 *
 * This module deliberately imports nothing from Node or Next so it can run in
 * middleware, server components and tests alike. The session record and the
 * cookie JWT are created and verified here; `server/auth/session.ts` adds the
 * server-only lifecycle (identifier generation, read/write the request
 * cookies).
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
  readonly exp?: number;
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
      .importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
        "sign",
        "verify",
      ])
      .catch((cause: unknown) => {
        keyCache.delete(secret);
        throw cause;
      });
    keyCache.set(secret, key);
  }
  return key;
}

/** Sign a session into a cookie value. Fixed header, issuer and audience. */
export async function signSession(session: Session): Promise<string> {
  return new SignJWT({
    sid: session.id,
    uid: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    teamId: session.user.teamId,
  } satisfies Omit<SessionPayload, "exp">)
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
 * tokens and InvalidSessionError for anything malformed or forged.
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
  if (typeof payload.exp !== "number") {
    throw new InvalidSessionError("Session payload has no expiry.");
  }

  return toSession(payload);
}

export function toSession(payload: SessionPayload): Session {
  return {
    id: payload.sid,
    expiresAt: (payload.exp as number) * 1_000,
    user: {
      id: payload.uid,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      teamId: payload.teamId ?? null,
      initials: payload.name.trim().slice(0, 2).toUpperCase(),
    } satisfies UserProfile,
  };
}

/**
 * Verify a cookie value straight from a middleware-style cookie string, or
 * return null when it is absent/malformed/expired - the shape middleware
 * wants so a bad cookie behaves like a signed-out visitor.
 */
export async function sessionFromCookieString(cookieValue: string | undefined): Promise<Session | null> {
  if (!cookieValue) return null;
  try {
    return await verifySession(cookieValue);
  } catch {
    return null;
  }
}