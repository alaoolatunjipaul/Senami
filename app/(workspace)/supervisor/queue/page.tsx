import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Live queue" };

export default function SupervisorQueuePage() {
  return (
    <ScopeNotice
      title="Live queue"
      phase="Phase 9"
      description="Real-time queue of in-flight conversations with grouped views by priority and channel arrives with the supervisor console."
    />
  );
}
