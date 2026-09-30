import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Cases" };

const CASE_LABELS: Record<string, string> = {
  complaints: "Complaints",
  enquiries: "Enquiries",
  requests: "Requests",
  "follow-ups": "Follow-ups",
};

export default async function CaseTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const label = CASE_LABELS[type] ?? "Cases";

  return (
    <ScopeNotice
      title={label}
      phase="Phase 7"
      description={`The ${label.toLowerCase()} workspace - lives across channels, escalations, priorities and SLA - arrives with the case engine.`}
    />
  );
}
