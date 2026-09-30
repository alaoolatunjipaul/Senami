import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/features/shell/app-shell";
import { getSessionFromCookies } from "@/server/auth/session";
import { logoutAction } from "@/server/auth/actions";
import { searchAll } from "@/server/search/search";

/**
 * Authenticated application shell.
 *
 * Every route inside `(workspace)` is a real feature workspace. The layout
 * establishes the session and hands the shell an honest search provider;
 * middleware performs route-level authorization first, and this layout is the
 * second line of defence.
 */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  return (
    <AppShell session={session} search={searchAll} onSignOut={logoutAction}>
      {children}
    </AppShell>
  );
}
