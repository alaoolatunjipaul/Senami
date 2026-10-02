"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { FilterChipRow } from "@/features/supervisor/supervisor-primitives";
import { useSupervisorPerformance } from "@/features/supervisor/use-supervisor";
import { PERFORMANCE_WINDOW_LABELS } from "@/lib/domain/performance";

export function SupervisorPerformanceView() {
  const [window, setWindow] = useState<"today" | "week" | "month">("today");
  const { data, isLoading, isError, refetch } = useSupervisorPerformance(window);

  if (isLoading) {
    return <LoadingState label="Loading performance" />;
  }
  if (isError || !data) {
    return <ErrorState title="Unable to load performance" description="Could not fetch metrics." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <FilterChipRow
        label="Window"
        value={window}
        onChange={(v) => setWindow(v as "today" | "week" | "month")}
        options={Object.entries(PERFORMANCE_WINDOW_LABELS).map(([v, l]) => ({ value: v, label: l }))}
      />
      <Card className="p-3 space-y-2">
        <p className="text-ink text-sm font-medium">Team</p>
        <p className="text-ink-muted text-xs" data-numeric>
          Handled: {data.team.handled} | Resolved: {data.team.resolved}
        </p>
        <p className="text-ink-subtle text-xs">{data.note}</p>
      </Card>
    </div>
  );
}
