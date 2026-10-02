"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useSupervisorAudit } from "@/features/supervisor/use-supervisor";
import { formatRelativeTime } from "@/lib/format";

export function SupervisorAuditView() {
  const params = useMemo(() => new URLSearchParams(), []);
  const { data, isLoading, isError, refetch } = useSupervisorAudit(params);

  if (isLoading) {
    return <LoadingState label="Loading audit" />;
  }
  if (isError || !data) {
    return <ErrorState title="Unable to load audit" description="Could not fetch audit log." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      {data.items.length === 0 ? (
        <EmptyState title="No audit entries" description="No events recorded." />
      ) : (
        <Card>
          <ul className="divide-line divide-y">
            {data.items.slice(0, 50).map((item) => (
                <li key={item.eventId} className="space-y-1 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-ink text-xs font-medium">{item.type}</p>
                    <p className="text-ink-subtle text-xs">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                  <p className="text-ink-muted text-xs">{item.actor}</p>
                  <p className="text-ink-muted truncate text-xs">{item.summary}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
