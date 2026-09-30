"use client";

import { DemoBanner } from "@/features/shell/demo-banner";
import { GlobalSearch, type SearchResultGroup } from "@/features/shell/global-search";
import { NotificationsPopover, type NotificationItem } from "@/features/shell/notifications";
import { ProfileMenu } from "@/features/shell/profile-menu";
import { Sidebar } from "@/features/shell/sidebar";
import { ConnectivityBanner } from "@/features/shell/connectivity";
import type { Session } from "@/lib/domain/user";
import type { NavCounts } from "@/lib/domain/navigation";
import type { ReactNode } from "react";

/**
 * The authenticated application shell (§10-§13).
 *
 * Layout: demo banner, sidebar with role-scoped navigation and dynamic counts,
 * header with global search and notifications, then the routed page. The shell
 * is purely presentational; sessions come from the server layout.
 */
export interface AppShellProps {
  session: Session;
  counts?: NavCounts;
  search: (query: string) => Promise<readonly SearchResultGroup[]> | readonly SearchResultGroup[];
  notifications?: readonly NotificationItem[];
  onSignOut?: () => void;
  children: ReactNode;
}

export function AppShell({
  session,
  counts,
  search,
  notifications = [],
  onSignOut,
  children,
}: AppShellProps) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar role={session.user.role} counts={counts} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ConnectivityBanner />
          <header className="border-line bg-surface flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <GlobalSearch search={search} className="w-full max-w-md" />
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <NotificationsPopover items={notifications} />
              <ProfileMenu session={session} onSignOut={onSignOut} />
            </div>
          </header>
          <main className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
