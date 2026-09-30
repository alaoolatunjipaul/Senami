import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { can } from "@/server/rbac/permissions";
import { canAccessRoute, homePathForRole, routePermissionFor } from "@/server/rbac/routes";
import { sessionFromCookieString, SESSION_COOKIE } from "@/server/auth/session-cookie";

/**
 * Request gate (Phase 4).
 *
 * Every request that reaches a feature is checked here before any component
 * renders:
 *  - signed out on a protected page  -> /login
 *  - signed in on /login             -> the role's home
 *  - role not entitled to a route    -> the role's home
 *  - API calls: 401 without a session, 403 when the route permission is not
 *    held (finer-grained per-endpoint checks happen in the handlers)
 *
 * The session cookie is never readable by client code, so the gate always
 * re-verifies the signature rather than trusting a client flag.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await sessionFromCookieString(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const permission = routePermissionFor(pathname);
    if (permission !== null && !can(session.user.role, permission)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (!session) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(session.user.role);
    return NextResponse.redirect(url);
  }

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!canAccessRoute(session.user.role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(session.user.role);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Every path except static assets: images, fonts and framework internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};