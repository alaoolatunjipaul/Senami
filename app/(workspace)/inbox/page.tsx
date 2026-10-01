import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { InboxProvider } from "@/features/inbox/inbox-provider";
import { InboxView } from "@/features/inbox/inbox-view";
import { PageHeader } from "@/features/shell/page-header";

export const metadata: Metadata = { title: "Inbox" };

/**
 * Social inbox (§15).
 *
 * Server shell + client view. The client view fetches filtered pages from
 * `/api/conversations`, so all filtering, search, pagination, counts and
 * selection are real. Data comes from the deterministic store in this phase;
 * the same API will be served by Prisma later.
 */
export default function InboxPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Inbox" description="Unified queue across every channel" />
      <div className="min-h-0 flex-1">
        <InboxProvider>
          <Suspense fallback={<LoadingState label="Loading the inbox…" />}>
            <InboxView />
          </Suspense>
        </InboxProvider>
      </div>
    </div>
  );
}