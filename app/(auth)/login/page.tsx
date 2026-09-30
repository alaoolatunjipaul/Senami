import type { Metadata } from "next";

import { ROLE_LABELS, ROLE_ORDER } from "@/lib/domain/user";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Sign in screen.
 *
 * The seat of the demo authentication flow (Phase 4). Until then this screen
 * honestly states that sign-in ships in the next phase instead of presenting a
 * form that cannot work - there is no user store yet (spec §56).
 */
export default function LoginPage() {
  return (
    <div className="border-line bg-surface w-full max-w-md rounded-xl border p-8 shadow-lg">
      <h1 className="text-ink text-lg font-semibold tracking-tight">Sign in to Senami</h1>
      <p className="text-ink-muted mt-1 text-sm">
        Authentication is the next phase of the build. When it ships, you will sign in by picking a
        demo role.
      </p>

      <ul className="mt-6 space-y-2">
        {ROLE_ORDER.map((role) => (
          <li
            key={role}
            className="border-line text-ink-secondary bg-canvas flex items-center justify-between rounded-md border px-3 py-2.5 text-sm"
          >
            <span className="font-medium">{ROLE_LABELS[role]}</span>
            <span className="text-ink-subtle text-xs">demo account</span>
          </li>
        ))}
      </ul>

      <p className="text-ink-subtle mt-6 text-xs leading-relaxed">
        Every account in the demo is synthetic. Roles control what each person sees: agents work the
        inbox, supervisors run queues, QA reviews, and administrators operate the platform.
      </p>
    </div>
  );
}
