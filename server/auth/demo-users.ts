import { deriveInitials, ROLE_DESCRIPTIONS, ROLES } from "@/lib/domain/user";
import type { Role, UserProfile } from "@/lib/domain/user";

/**
 * Demo user registry.
 *
 * Senami runs in demonstration mode (§4, §47): every account is synthetic and
 * the sign-in screen is a role picker rather than a credential check. One
 * canonical identity per role. This module becomes a read from the user store
 * when it ships (Phase 5+); the shape is the contract the store keeps.
 */

export interface DemoAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly teamId: string | null;
}

const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "usr_agent_maya",
    name: "Maya Keller",
    email: "maya.keller@senami.demo",
    role: "AGENT",
    teamId: "team_support_eu",
  },
  {
    id: "usr_sup_david",
    name: "David Okoro",
    email: "david.okoro@senami.demo",
    role: "SUPERVISOR",
    teamId: "team_support_eu",
  },
  {
    id: "usr_qa_amara",
    name: "Amara Osei",
    email: "amara.osei@senami.demo",
    role: "QA",
    teamId: null,
  },
  {
    id: "usr_admin_priya",
    name: "Priya Nair",
    email: "priya.nair@senami.demo",
    role: "ADMIN",
    teamId: null,
  },
];

export function getAllDemoAccounts(): readonly DemoAccount[] {
  return DEMO_ACCOUNTS;
}

/** The canonical demo account for a role, or null when unknown. */
export function demoAccountForRole(role: Role): DemoAccount | null {
  return DEMO_ACCOUNTS.find((account) => account.role === role) ?? null;
}

/** Every selectable role in canonical order, with its demo account. */
export function demoRoleOptions(): ReadonlyArray<{ readonly role: Role; readonly account: DemoAccount }> {
  return ROLES.flatMap((role) => {
    const account = demoAccountForRole(role);
    return account ? [{ role, account }] : [];
  });
}

export function roleDescription(role: Role): string {
  return ROLE_DESCRIPTIONS[role];
}

/** Convert a demo account into the identity we put in a session. */
export function profileFromAccount(account: DemoAccount): UserProfile {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    teamId: account.teamId,
    initials: deriveInitials(account.name),
  };
}