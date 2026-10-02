import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorAuditView } from "@/features/supervisor/supervisor-audit-view";

export const metadata: Metadata = { title: "Audit" };

export default function SupervisorAuditPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Audit" description="Team-wide audit events" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading audit" />}>
            <SupervisorAuditView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
