import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "AI settings" };

export default function AdminAiPage() {
  return (
    <ScopeNotice
      title="AI settings"
      phase="Phase 15"
      description="Provider selection, model lockdown, drafts behaviour and safe-response toggles arrive with the administration phase."
    />
  );
}
