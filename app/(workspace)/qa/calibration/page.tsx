import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "QA calibration" };

export default function QaCalibrationPage() {
  return (
    <ScopeNotice
      title="Calibration"
      phase="Phase 13"
      description="Calibration sessions and rater agreement arrive with the quality assurance phase."
    />
  );
}
