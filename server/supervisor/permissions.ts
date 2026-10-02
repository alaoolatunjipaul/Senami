import { ROLES, type Role } from "@/lib/domain/user";
import {
  PERMISSION_LABELS,
  PERMISSIONS,
  can,
  permissionsForRole,
  type Permission,
} from "@/server/rbac/permissions";

/**
 * Supervisor capability map (§25, §26).
 *
 * The console does not guess what a role may do: every control on it is backed by
 * one entry here, and the same entry drives the button's visibility and the
 * server's authorisation. Rendering the map as its own page means a supervisor can
 * answer "why can't I do that?" without guessing.
 */

export const SUPERVISOR_CAPABILITY_AREAS = [
  "queue",
  "team",
  "sla",
  "escalations",
  "qa",
  "performance",
  "audit",
] as const;

export type SupervisorCapabilityArea = (typeof SUPERVISOR_CAPABILITY_AREAS)[number];

export const SUPERVISOR_AREA_LABELS: Record<SupervisorCapabilityArea, string> = {
  queue: "Live queue",
  team: "Team monitoring",
  sla: "SLA monitoring",
  escalations: "Escalations",
  qa: "QA review",
  performance: "Team performance",
  audit: "Audit trail",
};

/** Area titles, in the order the console presents them. */
export const SUPERVISOR_AREA_ORDER: readonly SupervisorCapabilityArea[] = SUPERVISOR_CAPABILITY_AREAS;

/**
 * The capability catalogue. Each entry names the permission that backs it, so the
 * grant column is read from the RBAC table rather than maintained separately.
 */
export const SUPERVISOR_CAPABILITIES: ReadonlyArray<{
  readonly id: string;
  readonly area: SupervisorCapabilityArea;
  readonly permission: Permission;
  readonly summary: string;
}> = [
  {
    id: "view_queue",
    area: "queue",
    permission: "supervisor.queue.view",
    summary: "See every conversation across the team, not only assigned work.",
  },
  {
    id: "reassign",
    area: "queue",
    permission: "supervisor.assign",
    summary: "Assign, reassign and unassign conversations between agents.",
  },
  {
    id: "reprioritise",
    area: "queue",
    permission: "supervisor.priority.change",
    summary: "Raise or lower conversation priority, which changes the SLA deadline.",
  },
  {
    id: "view_team",
    area: "team",
    permission: "supervisor.team.view",
    summary: "See agent presence, workload and capacity across the team.",
  },
  {
    id: "view_sla",
    area: "sla",
    permission: "supervisor.sla.view",
    summary: "See live SLA risk, breaches and compliance for the team.",
  },
  {
    id: "view_escalations",
    area: "escalations",
    permission: "supervisor.escalations.view",
    summary: "See every escalation raised by an agent, with its reason.",
  },
  {
    id: "resolve_escalations",
    area: "escalations",
    permission: "supervisor.escalation.resolve",
    summary: "Deal with an escalation, returning it to the live queue with a note.",
  },
  {
    id: "view_qa",
    area: "qa",
    permission: "qa.view",
    summary: "See conversations flagged for quality review.",
  },
  {
    id: "review_qa",
    area: "qa",
    permission: "supervisor.qa.review",
    summary: "Score a review against the quality checklist and approve or return it.",
  },
  {
    id: "view_performance",
    area: "performance",
    permission: "supervisor.performance.view",
    summary: "See team and per-agent response and SLA performance.",
  },
  {
    id: "view_audit",
    area: "audit",
    permission: "supervisor.audit.view",
    summary: "Read the team-wide chronological audit trail.",
  },
  {
    id: "view_own_permissions",
    area: "audit",
    permission: "supervisor.permissions.view",
    summary: "See the capability map on this page.",
  },
];

export interface SupervisorCapability {
  readonly id: string;
  readonly area: SupervisorCapabilityArea;
  readonly areaLabel: string;
  readonly permission: Permission;
  readonly permissionLabel: string;
  readonly summary: string;
  readonly granted: boolean;
}

function toCapability(
  entry: (typeof SUPERVISOR_CAPABILITIES)[number],
  role: Role,
): SupervisorCapability {
  return {
    id: entry.id,
    area: entry.area,
    areaLabel: SUPERVISOR_AREA_LABELS[entry.area],
    permission: entry.permission,
    permissionLabel: PERMISSION_LABELS[entry.permission],
    summary: entry.summary,
    granted: can(role, entry.permission),
  };
}

export interface SupervisorCapabilityGroup {
  readonly area: SupervisorCapabilityArea;
  readonly label: string;
  readonly capabilities: readonly SupervisorCapability[];
  readonly granted: number;
  readonly total: number;
}

/** The capability map for one role, grouped by console area. */
export function supervisorCapabilities(role: Role): readonly SupervisorCapabilityGroup[] {
  return SUPERVISOR_AREA_ORDER.map((area) => {
    const capabilities = SUPERVISOR_CAPABILITIES.filter((entry) => entry.area === area).map((entry) =>
      toCapability(entry, role),
    );
    return {
      area,
      label: SUPERVISOR_AREA_LABELS[area],
      capabilities,
      granted: capabilities.filter((capability) => capability.granted).length,
      total: capabilities.length,
    };
  });
}

export interface SupervisorPermissionSummary {
  readonly role: Role;
  readonly roleLabel: string;
  readonly groups: readonly SupervisorCapabilityGroup[];
  readonly granted: number;
  readonly total: number;
  /** Every permission the role holds, for the full list below the capability map. */
  readonly allPermissions: readonly { readonly permission: Permission; readonly label: string; readonly granted: boolean }[];
  /**
   * Permissions the role conspicuously lacks, so the page can state what it does
   * not do instead of leaving an operator to infer it from silence.
   */
  readonly notHeld: readonly { readonly permission: Permission; readonly label: string }[];
}

/**
 * Administrative permissions are deliberately excluded from `notHeld`: every role
 * lacks most of them, and listing twenty platform-management permissions a
 * supervisor was never expected to hold would read as a defect.
 */
const PLATFORM_ADMIN_PERMISSIONS: readonly Permission[] = [
  "users.manage",
  "channel.manage",
  "sla.manage",
  "ai.manage",
  "category.manage",
];

export function supervisorPermissionSummary(role: Role, roleLabel: string): SupervisorPermissionSummary {
  const groups = supervisorCapabilities(role);
  const held = new Set(permissionsForRole(role));

  return {
    role,
    roleLabel,
    groups,
    granted: groups.reduce((total, group) => total + group.granted, 0),
    total: groups.reduce((total, group) => total + group.total, 0),
    allPermissions: PERMISSIONS.map((permission) => ({
      permission,
      label: PERMISSION_LABELS[permission],
      granted: held.has(permission),
    })),
    notHeld: PERMISSIONS.filter(
      (permission) =>
        !held.has(permission) && !PLATFORM_ADMIN_PERMISSIONS.includes(permission),
    ).map((permission) => ({ permission, label: PERMISSION_LABELS[permission] })),
  };
}

/** Whether a role holds every capability the console offers. */
export function hasAllSupervisorCapabilities(role: Role): boolean {
  return SUPERVISOR_CAPABILITIES.every((entry) => can(role, entry.permission));
}

/**
 * The roles that can reach the supervisor console at all, for the sign-in hint and
 * for tests.
 */
export const SUPERVISOR_CONSOLE_ROLES: readonly Role[] = ROLES.filter((role) =>
  can(role, "supervisor.queue.view"),
);
