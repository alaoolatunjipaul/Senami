import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { SupervisorProvider } from "@/features/supervisor/supervisor-provider";
import { SupervisorQaView } from "@/features/supervisor/supervisor-qa-view";

export const metadata: Metadata = { title: "QA review" };

export default function SupervisorQaPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="QA / Review" description="Conversations awaiting quality review" />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SupervisorProvider>
          <Suspense fallback={<LoadingState label="Loading QA queue" />}>
            <SupervisorQaView />
          </Suspense>
        </SupervisorProvider>
      </div>
    </div>
  );
}
