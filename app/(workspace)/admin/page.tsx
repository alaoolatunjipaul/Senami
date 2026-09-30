import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Administration" };

export default function AdminOverviewPage() {
  return (
    <ScopeNotice
      title="Administration"
      phase="Phase 15"
      description="Platform administration across channels, SLA policies, AI settings, categories and audit arrive with the administration phase."
    />
  );
}
