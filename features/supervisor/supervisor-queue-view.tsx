"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { KpiGrid } from "@/features/supervisor/supervisor-primitives";
import { QueueFilters, SupervisorQueueTable } from "@/features/supervisor/queue-table";
import { useSupervisorQueue } from "@/features/supervisor/use-supervisor";
import { DEFAULT_SUPERVISOR_QUEUE_QUERY } from "@/lib/domain/supervisor";

export function SupervisorQueueView() {
  const [query, setQuery] = useState(DEFAULT_SUPERVISOR_QUEUE_QUERY);
  const { data, isLoading, isError } = useSupervisorQueue(query);
  const rows = data?.page.items ?? [];
  const kpis = data?.kpis ?? [];

  return (
    <div className="space-y-4">
      <KpiGrid kpis={kpis} />
      <QueueFilters
        query={query}
        onQueryChange={(next) => setQuery((q) => ({ ...q, ...next }))}
        onReset={() => setQuery(DEFAULT_SUPERVISOR_QUEUE_QUERY)}
      />
      <SupervisorQueueTable
        rows={rows}
        query={query}
        onQueryChange={(next) => setQuery((q) => ({ ...q, ...next }))}
        isLoading={isLoading}
        isError={isError}
        errorMessage={isError ? "The queue could not be loaded." : null}
        total={data?.page.total ?? 0}
      />
      {data?.page.pageCount && data.page.pageCount > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-ink-muted text-xs">
            Page {data.page.page} of {data.page.pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={query.page <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, q.page - 1) }))}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={query.page >= data.page.pageCount}
              onClick={() => setQuery((q) => ({ ...q, page: Math.min(data.page.pageCount, q.page + 1) }))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
