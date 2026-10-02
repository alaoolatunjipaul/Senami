import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorSlaView } from "@/features/supervisor/supervisor-sla-view";

export const metadata: Metadata = { title: "SLA monitoring" };

export default function SupervisorSlaPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="SLA" description="First-response and resolution SLA tracking" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading SLA data" />}>
            <SupervisorSlaView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
