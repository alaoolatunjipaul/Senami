import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "My performance" };

export default function PerformancePage() {
  return (
    <ScopeNotice
      title="My performance"
      phase="Phase 10"
      description="Agent metrics - response time, SLA adherence, handle time, ratings and weekly trends - arrive with the analytics phase."
    />
  );
}
