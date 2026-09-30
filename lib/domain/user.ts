/**
 * Users, roles and sessions.
 *
 * Phase 3 defines the role model because the shell's navigation is role-aware.
 * Phase 4 adds the authentication flows, the session lifecycle and the full RBAC
 * permission engine. The types here are the contract both sides work against.
 */

export const ROLES = ["AGENT", "SUPERVISOR", "QA", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  AGENT: "Agent",
  SUPERVISOR: "Supervisor",
  QA: "QA Analyst",
  ADMIN: "Administrator",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  AGENT: "Handles customer conversations",
  SUPERVISOR: "Runs team operations and monitors queues",
  QA: "Reviews and scores completed interactions",
  ADMIN: "Manages the platform",
};

/** Canonical order used in login screens and admin user tables. */
export const ROLE_ORDER: ReadonlyArray<Role> = ["AGENT", "SUPERVISOR", "QA", "ADMIN"];

export interface UserProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  /** Team membership, if configured. */
  readonly teamId: string | null;
  /** Presentation detail derived from the name. */
  readonly initials: string;
}

/** Derive up to two initials from a display name. */
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();

  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export interface Session {
  /** Opaque session identifier. Never exposed to the browser as a value. */
  readonly id: string;
  readonly user: UserProfile;
  /** Absolute expiry as epoch milliseconds. */
  readonly expiresAt: number;
}
