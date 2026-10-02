import { can, type Permission } from "@/server/rbac/permissions";
import type { Role } from "@/lib/domain/user";

/**
 * Route-level authorization.
 *
 * Maps pathname prefixes to the permission that entitles a role to open them.
 * Middleware enforces this for every request; workspace layouts provide a
 * second line of defence. Unknown public or future routes return null, which
 * the caller treats as "no route-level restriction" - API handlers and data
 * phases assert finer-grained permissions themselves.
 */

const ROUTE_PERMISSIONS: ReadonlyArray<readonly [prefix: string, permission: Permission]> = [
  ["/admin", "users.manage"],
  // Supervisor child routes are matched before the "/supervisor" catch-all below,
  // so each is guarded by its own permission rather than the overview's.
  ["/supervisor/ai", "supervisor.ai.view"],
  ["/supervisor/sla", "supervisor.sla.view"],
  ["/supervisor/escalations", "supervisor.escalations.view"],
  ["/supervisor/team", "supervisor.team.view"],
  ["/supervisor/queue", "supervisor.queue.view"],
  ["/supervisor/qa", "supervisor.qa.review"],
  ["/supervisor/performance", "supervisor.performance.view"],
  ["/supervisor/audit", "supervisor.audit.view"],
  ["/supervisor/permissions", "supervisor.permissions.view"],
  ["/supervisor", "report.view"],
  ["/qa", "qa.view"],
  ["/performance", "performance.view"],
  ["/cases", "case.view"],
  ["/interactions", "interaction.view"],
  ["/channels", "channel.view"],
  ["/inbox", "inbox.view"],
  ["/dashboard", "inbox.view"],
];

const ROUTE_PREFIXES = ROUTE_PERMISSIONS.map(([prefix]) => prefix);

/** The permission that guards a pathname, or null when unrestricted. */
export function routePermissionFor(pathname: string): Permission | null {
  const exact = ROUTE_PERMISSIONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return exact?.[1] ?? null;
}

/** Whether a role may open a pathname. */
export function canAccessRoute(role: Role | null, pathname: string): boolean {
  const permission = routePermissionFor(pathname);
  if (permission === null) return true;
  return can(role, permission);
}

/** Sensible home for a role when a route was blocked. */
export function homePathForRole(role: Role | null): "/dashboard" | "/inbox" | "/login" {
  if (role === null) return "/login";
  if (!can(role, "inbox.view")) return "/login";
  // Agents work from their own workspace; everyone else lands on the queue.
  return role === "AGENT" ? "/dashboard" : "/inbox";
}

/** Extracted so middleware shares the exact list with tests. */
export function registeredRoutePrefixes(): readonly string[] {
  return ROUTE_PREFIXES;
}