import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Channel configuration" };

export default function AdminChannelsPage() {
  return (
    <ScopeNotice
      title="Channels"
      phase="Phase 15"
      description="Channel credentials, accounts and connection health arrive with the administration phase."
    />
  );
}
