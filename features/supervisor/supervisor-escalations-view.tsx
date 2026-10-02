"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FilterChipRow } from "@/features/supervisor/supervisor-primitives";
import { useSupervisorEscalations } from "@/features/supervisor/use-supervisor";
import { ESCALATION_FILTER_LABELS } from "@/lib/domain/escalation";

export function SupervisorEscalationsView() {
  const [filter, setFilter] = useState("open");
  const { data, isLoading, isError, refetch } = useSupervisorEscalations(filter);

  if (isLoading) {
    return <LoadingState label="Loading escalations" />;
  }
  if (isError || !data) {
    return <ErrorState title="Unable to load escalations" description="Could not fetch escalations." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <FilterChipRow
        label="Filter"
        value={filter}
        onChange={setFilter}
        options={Object.entries(ESCALATION_FILTER_LABELS).map(([v, l]) => ({ value: v, label: l }))}
      />
      {data.rows.length === 0 ? (
        <EmptyState title="No escalations" description="No escalations match this filter." />
      ) : (
        <Card>
          <ul className="divide-line divide-y">
            {data.rows.map((r) => (
                <li key={r.conversationId} className="space-y-1 px-3 py-2">
                  <p className="text-ink text-xs font-medium">{r.conversationId}</p>
                  <p className="text-ink-muted text-xs">{r.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
