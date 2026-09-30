import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Users and teams" };

export default function AdminUsersPage() {
  return (
    <ScopeNotice
      title="Users & teams"
      phase="Phase 15"
      description="User management, roles, teams and permissions arrive with the administration phase."
    />
  );
}
