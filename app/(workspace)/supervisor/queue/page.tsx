import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorQueueView } from "@/features/supervisor/supervisor-queue-view";

export const metadata: Metadata = { title: "Live queue" };

export default function SupervisorQueuePage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Live queue" description="Team-wide queue from live conversation state" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading the live queue" />}>
            <SupervisorQueueView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
