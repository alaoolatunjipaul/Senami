import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "QA scoring" };

export default function QaScoringPage() {
  return (
    <ScopeNotice
      title="Scoring"
      phase="Phase 13"
      description="Per-interaction scorecards and the QA rubric arrive with the quality assurance phase."
    />
  );
}
