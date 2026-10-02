import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorPermissionsView } from "@/features/supervisor/supervisor-permissions-view";

export const metadata: Metadata = { title: "Permissions" };

export default function SupervisorPermissionsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Permissions" description="Supervisor permission set" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading permissions" />}>
            <SupervisorPermissionsView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
