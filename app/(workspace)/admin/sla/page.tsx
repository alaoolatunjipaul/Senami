import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "SLA policies" };

export default function AdminSlaPage() {
  return (
    <ScopeNotice
      title="SLA policies"
      phase="Phase 15"
      description="Response-time policies, public-holiday handling and priority mapping arrive with the administration phase."
    />
  );
}
