import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Team" };

export default function SupervisorTeamPage() {
  return (
    <ScopeNotice
      title="Team"
      phase="Phase 9"
      description="Agent seats, assignment loads, presence and workload balancing arrive with the supervisor console and the user store."
    />
  );
}
