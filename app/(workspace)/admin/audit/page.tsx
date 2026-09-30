import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Audit log" };

export default function AdminAuditPage() {
  return (
    <ScopeNotice
      title="Audit log"
      phase="Phase 16"
      description="The tamper-evident audit trail of every user action arrives with the audit phase."
    />
  );
}
