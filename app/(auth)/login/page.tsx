import type { Metadata } from "next";

import { loginAsDemoUser } from "@/server/auth/actions";
import { demoRoleOptions, roleDescription } from "@/server/auth/demo-users";
import { getCurrentUser } from "@/server/auth/session";
import { homePathForRole } from "@/server/rbac/routes";
import { ROLE_LABELS, type Role } from "@/lib/domain/user";
import { redirect } from "next/navigation";
import { FirstBankLogo } from "@/components/ui/firstbank-logo";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Sign in screen (Phase 4).
 *
 * Senami is a demonstration platform, so sign-in is a role picker over the
 * canonical synthetic accounts listed in the demo registry. The server action
 * is the only thing that can sign the session cookie; the passwordless flow is
 * honest about being a demo - production would swap this for real credentials
 * against the user store.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  const { reason } = await searchParams;
  const options = demoRoleOptions();

  return (
    <div className="border-line bg-surface w-full max-w-xl rounded-xl border p-8 shadow-lg">
      <div className="flex items-center gap-3 mb-2">
        <FirstBankLogo size="lg" />
        <div>
          <h1 className="text-ink text-lg font-bold tracking-tight">Senami</h1>
          <p className="text-ink-muted text-xs">FirstBank Social Customer Service Platform</p>
        </div>
      </div>

      <p className="text-ink-muted mt-3 text-sm">
        Select your account to access the social response desk.
      </p>

      {reason === "unknown-role" ? (
        <p role="alert" className="bg-critical-subtle text-critical mt-4 rounded-md border border-critical-muted px-3 py-2 text-xs">
          That session could not be started. Choose a role below.
        </p>
      ) : null}

      <ul className="mt-6 space-y-2">
        {options.map(({ role }) => (
          <li key={role}>
            <LoginCard role={role} />
          </li>
        ))}
      </ul>

      <RoleNote />
    </div>
  );
}

function LoginCard({ role }: { role: Role }) {
  return (
    <form
      action={loginAsDemoUser.bind(null, role)}
      className="border-line hover:border-primary/50 bg-canvas group flex items-center gap-3 rounded-lg border p-3 transition-colors duration-fast focus-within:ring-[3px] focus-within:ring-primary/30"
    >
      <span className="bg-primary-subtle text-primary-ink flex size-9 items-center justify-center rounded-full text-xs font-semibold" aria-hidden="true">
        {ROLE_LABELS[role].slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink block text-sm font-medium">{ROLE_LABELS[role]}</span>
        <span className="text-ink-muted block text-xs">{roleDescription(role)}</span>
      </span>
      <button
        type="submit"
        className="text-primary-ink bg-primary-subtle hover:bg-primary-muted text-ink-secondary group-hover:border-primary/40 rounded-md border border-transparent px-3 py-1.5 text-xs font-medium transition-colors duration-fast"
      >
        Sign in as {ROLE_LABELS[role]}
      </button>
    </form>
  );
}

function RoleNote() {
  return (
    <p className="text-ink-subtle mt-6 text-xs leading-relaxed">
      Roles control what each person sees and does: agents work the inbox,
      supervisors run queues, QA reviews, and administrators operate the
      platform. Access is enforced server-side - the menu only reflects it.
    </p>
  );
}