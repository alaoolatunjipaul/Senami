import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "AI usage" };

export default function SupervisorAiPage() {
  return (
    <ScopeNotice
      title="AI usage"
      phase="Phase 11"
      description="Draft acceptance, model behaviour and suggestion quality arrive with the AI assistant phase."
    />
  );
}
