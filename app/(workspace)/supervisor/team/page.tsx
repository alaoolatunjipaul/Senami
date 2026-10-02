import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorTeamView } from "@/features/supervisor/supervisor-team-view";

export const metadata: Metadata = { title: "Team monitoring" };

export default function SupervisorTeamPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Agents" description="Live team workload and availability" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading team data" />}>
            <SupervisorTeamView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
