import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { AgentDashboardView } from "@/features/agent/agent-dashboard-view";
import { AgentQueryProvider } from "@/features/agent/agent-query-provider";
import { PageHeader } from "@/features/shell/page-header";

export const metadata: Metadata = { title: "Agent workspace" };

/**
 * Agent workspace dashboard (Phase 8, §10).
 *
 * The agent's landing page. Tiles deep-link into the inbox with the exact
 * filters for each bucket, response metrics are computed from real response
 * times, and today's activity comes from the audit trail. The trend is seeded
 * for the demo, never fabricated as measured history.
 */
export default function DashboardPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Agent workspace" description="Your queue, response metrics and today's activity" />
      <div className="min-h-0 flex-1">
        <AgentQueryProvider>
          <Suspense fallback={<LoadingState label="Loading your workspace" />}>
            <AgentDashboardView />
          </Suspense>
        </AgentQueryProvider>
      </div>
    </div>
  );
}