import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "SLA overview" };

export default function SupervisorSlaPage() {
  return (
    <ScopeNotice
      title="SLA overview"
      phase="Phase 9"
      description="SLA health across channels and teams - breaches, near-misses and policy drift - arrives with the supervisor console."
    />
  );
}
