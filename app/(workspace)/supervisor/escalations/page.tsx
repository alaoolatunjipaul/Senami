import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Escalations" };

export default function SupervisorEscalationsPage() {
  return (
    <ScopeNotice
      title="Escalations"
      phase="Phase 9"
      description="Escalation queues, acceptance timing and history arrive with the escalation engine and supervisor console."
    />
  );
}
