import { ROLES } from "@/lib/domain/user";
import type { Role } from "@/lib/domain/user";

/**
 * Role-based access control - the deny-by-default permission catalogue.
 *
 * The catalogue is the single source of truth for what every role may do, and
 * it is enforced on the server (API guards, route guards, server actions)
 * rather than only in the UI. A role receives exactly the union of permissions
 * listed below; anything not granted is denied.
 */

export const PERMISSIONS = [
  // Inbox & conversations
  "inbox.view",
  "conversation.read",
  "conversation.reply",
  "conversation.escalate",
  "conversation.pause",
  "conversation.resolve",
  "conversation.transfer",
  // AI assistance (drafting only - it never sends)
  "ai.assist",
  // Channels & interactions
  "channel.view",
  "interaction.view",
  // Cases
  "case.view",
  // Performance & reporting
  "performance.view",
  "report.view",
  // Supervisor console
  "supervisor.queue.view",
  "supervisor.team.view",
  "supervisor.escalations.view",
  "supervisor.sla.view",
  "supervisor.ai.view",
  // Supervisor operational authority (Phase 9)
  "supervisor.assign",
  "supervisor.priority.change",
  "supervisor.escalation.resolve",
  "supervisor.qa.review",
  "supervisor.performance.view",
  "supervisor.audit.view",
  "supervisor.permissions.view",
  // Quality assurance
  "qa.view",
  "qa.review",
  // Administration
  "users.manage",
  "channel.manage",
  "sla.manage",
  "ai.manage",
  "category.manage",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "inbox.view": "View the social inbox",
  "conversation.read": "Read conversations",
  "conversation.reply": "Reply to conversations",
  "conversation.escalate": "Escalate conversations",
  "conversation.pause": "Pause SLA-tracking on a conversation",
  "conversation.resolve": "Resolve conversations",
  "conversation.transfer": "Transfer conversations",
  "ai.assist": "Use AI drafting assistance",
  "channel.view": "View channels",
  "interaction.view": "View public posts, comments, DMs and mentions",
  "case.view": "View cases",
  "performance.view": "View personal performance",
  "report.view": "View reports",
  "supervisor.queue.view": "View the live queue",
  "supervisor.team.view": "View team workload",
  "supervisor.escalations.view": "View escalations",
  "supervisor.sla.view": "View SLA overview",
  "supervisor.ai.view": "View AI usage",
  "supervisor.assign": "Assign and reassign team conversations",
  "supervisor.priority.change": "Change conversation priority",
  "supervisor.escalation.resolve": "Deal with escalated conversations",
  "supervisor.qa.review": "Review interactions and submit QA reviews",
  "supervisor.performance.view": "View team performance",
  "supervisor.audit.view": "Read the team audit trail",
  "supervisor.permissions.view": "View the permissions held by your role",
  "qa.view": "View the QA workspace",
  "qa.review": "Score and review conversations",
  "users.manage": "Manage users and teams",
  "channel.manage": "Configure channels",
  "sla.manage": "Manage SLA policies",
  "ai.manage": "Configure AI settings",
  "category.manage": "Manage categories",
  "audit.view": "Read the audit log",
};

export const rolePermissionSets: Record<Role, ReadonlySet<Permission>> = {
  AGENT: new Set([
    "inbox.view",
    "conversation.read",
    "conversation.reply",
    "conversation.escalate",
    "conversation.pause",
    "conversation.resolve",
    "conversation.transfer",
    // Drafting assistance: the agent always reviews and sends what it produces.
    "ai.assist",
    // Public context arrives with the data phases; permissions already grant it.
    "channel.view",
    "interaction.view",
    "case.view",
    "performance.view",
  ]),
  SUPERVISOR: new Set([
    "inbox.view",
    "conversation.read",
    "conversation.escalate",
    "channel.view",
    "interaction.view",
    "case.view",
    "report.view",
    "supervisor.queue.view",
    "supervisor.team.view",
    "supervisor.escalations.view",
    "supervisor.sla.view",
    "supervisor.ai.view",
    // Operational authority over the team. Deliberately narrow: a supervisor
    // reassigns, re-prioritises, reviews and audits, but holds no administrative
    // control over the platform itself (§25).
    "supervisor.assign",
    "supervisor.priority.change",
    "supervisor.escalation.resolve",
    "supervisor.qa.review",
    "supervisor.performance.view",
    "supervisor.audit.view",
    "supervisor.permissions.view",
    "qa.view",
  ]),
  QA: new Set([
    "inbox.view",
    "conversation.read",
    "channel.view",
    "interaction.view",
    "case.view",
    "qa.view",
    "qa.review",
  ]),
  ADMIN: new Set([...PERMISSIONS]),
};

/** Whether a role may perform an action. Bounded: nothing is granted by default. */
export function can(role: Role | null, permission: Permission): boolean {
  if (role === null) return false;
  return (rolePermissionSets[role as Role] as ReadonlySet<Permission> | undefined)?.has(permission) ?? false;
}

export class ForbiddenError extends Error {
  override readonly name = "ForbiddenError";
  constructor(role: Role | null, permission: Permission) {
    super(`Role ${role ?? "none"} is not allowed to ${PERMISSION_LABELS[permission]}.`);
  }
}

/**
 * Deny-by-default check. Returns the role when permitted, otherwise throws
 * ForbiddenError - the handle callers use inside server code that must audit.
 */
export function requirePermission(role: Role | null, permission: Permission): asserts role is Role {
  if (!can(role, permission)) {
    throw new ForbiddenError(role, permission);
  }
}

/** Used by the sign-in screen to validate role choices before session creation. */
export function isKnownRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Return every permission a role holds, in canonical order, for tooling/tests. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return PERMISSIONS.filter((permission) => can(role, permission));
}