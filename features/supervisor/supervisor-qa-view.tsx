"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FilterChipRow } from "@/features/supervisor/supervisor-primitives";
import { useSupervisorQa } from "@/features/supervisor/use-supervisor";
import { QA_FILTER_LABELS } from "@/lib/domain/qa-review";

export function SupervisorQaView() {
  const [filter, setFilter] = useState("pending");
  const { data, isLoading, isError, refetch } = useSupervisorQa(filter);

  if (isLoading) {
    return <LoadingState label="Loading QA queue" />;
  }
  if (isError || !data) {
    return <ErrorState title="Unable to load QA" description="Could not fetch QA items." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <FilterChipRow
        label="Filter"
        value={filter}
        onChange={setFilter}
        options={Object.entries(QA_FILTER_LABELS).map(([v, l]) => ({ value: v, label: l }))}
      />
      {data.items.length === 0 ? (
        <EmptyState title="No reviews" description="No items match this filter." />
      ) : (
        <Card>
          <ul className="divide-line divide-y">
            {data.items.map((item) => (
                <li key={item.conversationId} className="px-3 py-2">
                <p className="text-ink text-xs font-medium">{item.conversationId}</p>
                <p className="text-ink-muted text-xs">{item.status}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
