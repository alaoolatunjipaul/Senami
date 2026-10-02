import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorPerformanceView } from "@/features/supervisor/supervisor-performance-view";

export const metadata: Metadata = { title: "Team performance" };

export default function SupervisorPerformancePage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Performance" description="Team and agent performance metrics" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading performance" />}>
            <SupervisorPerformanceView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
