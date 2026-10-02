"use client";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PresenceBadge, UtilisationBar } from "@/features/supervisor/supervisor-primitives";
import { useSupervisorTeam } from "@/features/supervisor/use-supervisor";

export function SupervisorTeamView() {
  const { data, isLoading, isError, refetch } = useSupervisorTeam("load");

  if (isLoading) {
    return <LoadingState label="Loading team data" />;
  }
  if (isError || !data) {
    return <ErrorState title="Unable to load team" description="Could not load workload." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-5">
        {["online", "busy", "away", "offline", "total"].map((k) => (
          <Card key={k} className="p-3 text-center">
            <p className="text-ink-muted text-xs uppercase">{k}</p>
              <p className="text-ink text-lg font-semibold" data-numeric>
                {(data.summary as Record<string, number>)[k] ?? 0}
              </p>
          </Card>
        ))}
      </div>
      {data.workloads.length === 0 ? (
        <EmptyState title="No agents" description="No agent workloads available." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.workloads.map((w) => (
            <Card key={w.agentId} className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink text-sm font-medium">{w.agentName}</p>
                  <p className="text-ink-subtle text-xs">{w.teamName ?? "—"}</p>
                </div>
                <PresenceBadge presence={w.presence} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Load</span>
                  <span data-numeric>
                    {w.activeConversations}/{w.capacity}
                  </span>
                </div>
                <UtilisationBar load={w.activeConversations} capacity={w.capacity} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
