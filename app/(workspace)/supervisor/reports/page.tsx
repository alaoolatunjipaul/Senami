import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Reports" };

export default function SupervisorReportsPage() {
  return (
    <ScopeNotice
      title="Reports"
      phase="Phase 12"
      description="Scheduled daily, weekly and monthly reports ship with the reporting phase."
    />
  );
}
