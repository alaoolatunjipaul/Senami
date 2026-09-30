"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import type { Role } from "@/lib/domain/user";
import {
  buildSession,
  SESSION_COOKIE,
  sessionCookieAttributes,
  signSession,
} from "@/server/auth/session";
import { demoAccountForRole, profileFromAccount } from "@/server/auth/demo-users";
import { isKnownRole } from "@/server/rbac/permissions";

/**
 * Authentication actions (Phase 4).
 *
 * The demo roof: sign-in picks a canonical synthetic role, the server signs a
 * session cookie, and the workspace is then fully gated. Logout clears the
 * cookie. Server actions are the only writers of the session cookie.
 */

/**
 * Sign in as the canonical demo account for a role. `_formData` is ignored but
 * present so the action is a valid HTML form action (`action` on `<form>`).
 */
export async function loginAsDemoUser(roleValue: string, _formData?: FormData): Promise<void> {
  if (!isKnownRole(roleValue)) {
    redirect("/login?reason=unknown-role");
  }
  const role = roleValue as Role;

  const account = demoAccountForRole(role);
  if (account === null) {
    redirect("/login?reason=unknown-role");
  }

  const session = buildSession(profileFromAccount(account));
  const token = await signSession(session);

  // Strict HttpOnly cookie; nothing client-side can read or mutate it.
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieAttributes());
  redirect("/inbox");
}

/** Sign out: clear the session cookie and return to the login screen. */
export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}