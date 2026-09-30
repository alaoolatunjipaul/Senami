import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "QA reviews" };

export default function QaReviewsPage() {
  return (
    <ScopeNotice
      title="Reviews"
      phase="Phase 13"
      description="The QA review queue, scoring rubrics and passing scores arrive with the quality assurance phase."
    />
  );
}
