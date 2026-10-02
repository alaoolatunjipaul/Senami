import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorOverviewView } from "@/features/supervisor/supervisor-overview-view";

export const metadata: Metadata = { title: "Supervisor overview" };

export default function SupervisorOverviewPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Supervisor overview" description="Live operations from shared conversation state" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading supervisor overview" />}>
            <SupervisorOverviewView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
