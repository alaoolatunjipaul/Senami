import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorEscalationsView } from "@/features/supervisor/supervisor-escalations-view";

export const metadata: Metadata = { title: "Escalations" };

export default function SupervisorEscalationsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Escalations" description="Open escalations with ownership and urgency" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading escalations" />}>
            <SupervisorEscalationsView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
