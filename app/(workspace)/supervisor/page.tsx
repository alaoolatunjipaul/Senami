import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Supervisor overview" };

export default function SupervisorOverviewPage() {
  return (
    <ScopeNotice
      title="Overview"
      phase="Phase 9"
      description="The command view - live queue, SLA heat, escalations and agent activity - arrives with the supervisor console."
    />
  );
}
