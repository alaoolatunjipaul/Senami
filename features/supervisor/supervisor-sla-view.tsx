"use client";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { SLAIndicator } from "@/components/ui/sla-indicator";
import { useSupervisorSla } from "@/features/supervisor/use-supervisor";

export function SupervisorSlaView() {
  const { data, isLoading, isError, refetch } = useSupervisorSla();

  if (isLoading) {
    return <LoadingState label="Loading SLA data" />;
  }
  if (isError || !data) {
    return <ErrorState title="Unable to load SLA" description="Could not load SLA status." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        {(["safe", "warning", "breached", "met", "paused"] as const).map((s) => (
          <Card key={s} className="p-3 text-center">
            <p className="text-ink-muted text-xs uppercase">{s}</p>
            <p className="text-ink text-lg font-semibold" data-numeric>
              {data.counts[s] ?? 0}
            </p>
          </Card>
        ))}
      </div>
      {data.rows.length === 0 ? (
        <EmptyState title="No SLA data" description="No conversations to evaluate." />
      ) : (
        <Card>
          <ul className="divide-line divide-y">
            {data.rows.slice(0, 50).map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="text-ink text-xs font-medium">{r.id}</p>
                  <p className="text-ink-muted truncate text-xs">{r.preview}</p>
                </div>
                <SLAIndicator evaluation={r.sla as never} compact />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
