"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { KpiGrid, PresenceBadge } from "@/features/supervisor/supervisor-primitives";
import { useSupervisorOverview } from "@/features/supervisor/use-supervisor";
import { formatRelativeTime } from "@/lib/format";

export function SupervisorOverviewView() {
  const { data, isLoading, isError, refetch } = useSupervisorOverview();
  const [now] = useState(() => new Date());

  const roster = useMemo(() => data?.roster ?? [], [data]);

  if (isLoading) {
    return <LoadingState label="Loading supervisor overview" />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Unable to load supervisor overview"
        description="Could not fetch the latest operational figures."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col">
          <div className="border-line flex items-center justify-between border-b px-3 py-2">
            <h3 className="text-ink text-sm font-semibold">Escalations</h3>
            <Link href="/supervisor/escalations" className="text-primary text-xs hover:underline">
              View board
            </Link>
          </div>
          <div className="flex-1 px-3 py-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Open", value: data.escalations.open },
                { label: "Aging 30m+", value: data.escalations.urgent },
                { label: "Critical", value: data.escalations.urgent },
              ].map((s) => (
                <div key={s.label} className="border-line rounded-md border p-2">
                  <p className="text-ink-muted text-[10px] uppercase">{s.label}</p>
                  <p className="text-ink text-base font-semibold" data-numeric>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
            {data.escalations.open === 0 ? (
              <p className="text-ink-subtle mt-2 text-xs">No open escalations.</p>
            ) : null}
          </div>
        </Card>

        <Card className="flex flex-col">
          <div className="border-line flex items-center justify-between border-b px-3 py-2">
            <h3 className="text-ink text-sm font-semibold">QA</h3>
            <Link href="/supervisor/qa" className="text-primary text-xs hover:underline">
              Review queue
            </Link>
          </div>
          <div className="flex-1 px-3 py-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Awaiting", value: data.qa.pending },
                { label: "High risk", value: data.qa.inReview },
                { label: "Due >30m", value: 0 },
              ].map((s) => (
                <div key={s.label} className="border-line rounded-md border p-2">
                  <p className="text-ink-muted text-[10px] uppercase">{s.label}</p>
                  <p className="text-ink text-base font-semibold" data-numeric>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
            {data.qa.pending === 0 ? (
              <p className="text-ink-subtle mt-2 text-xs">All reviews up to date.</p>
            ) : null}
          </div>
        </Card>

        <Card className="flex flex-col">
          <div className="border-line flex items-center justify-between border-b px-3 py-2">
            <h3 className="text-ink text-sm font-semibold">Roster</h3>
            <Link href="/supervisor/team" className="text-primary text-xs hover:underline">
              Team monitoring
            </Link>
          </div>
          <div className="max-h-[260px] space-y-1 overflow-y-auto p-2">
            {roster.map((r) => (
              <div key={r.agentId} className="border-line flex items-center justify-between rounded-md border p-2">
                <div className="min-w-0">
                  <p className="text-ink truncate text-xs font-medium">{r.agentName}</p>
                  <p className="text-ink-subtle text-[10px] uppercase">{r.teamId ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <PresenceBadge presence={r.presence} />
                  <span className="text-ink-muted text-xs" data-numeric>
                    0/0
                  </span>
                </div>
              </div>
            ))}
            {roster.length === 0 ? <EmptyState title="No agents online" description="Roster is empty." /> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-line flex items-center justify-between border-b px-3 py-2">
            <h3 className="text-ink text-sm font-semibold">Needs attention</h3>
            <Link href="/supervisor/queue" className="text-primary text-xs hover:underline">
              Open queue
            </Link>
          </div>
          {data.needsAttention.length === 0 ? (
            <EmptyState title="Nothing needs attention" description="All in-flight conversations look healthy." />
          ) : (
            <ul className="divide-line max-h-[280px] divide-y overflow-y-auto">
              {data.needsAttention.slice(0, 10).map((row) => (
                <li key={row.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/conversations/${row.id}`} className="text-ink truncate text-xs font-medium hover:underline">
                      {row.id}
                    </Link>
                    <p className="text-ink-muted line-clamp-1 text-xs">{row.preview}</p>
                  </div>
                  <p className="text-ink-subtle text-xs">{formatRelativeTime(row.lastMessageAt, now)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="border-line flex items-center justify-between border-b px-3 py-2">
            <h3 className="text-ink text-sm font-semibold">Unassigned</h3>
            <Link href="/supervisor/queue?assignment=unassigned" className="text-primary text-xs hover:underline">
              Assign now
            </Link>
          </div>
          {data.unassigned.length === 0 ? (
            <EmptyState title="All assigned" description="No conversations are waiting for an owner." />
          ) : (
            <ul className="divide-line max-h-[280px] divide-y overflow-y-auto">
              {data.unassigned.slice(0, 10).map((row) => (
                <li key={row.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/conversations/${row.id}`} className="text-ink truncate text-xs font-medium hover:underline">
                      {row.id}
                    </Link>
                    <p className="text-ink-muted line-clamp-1 text-xs">{row.preview}</p>
                  </div>
                  <p className="text-ink-subtle text-xs">{formatRelativeTime(row.receivedAt, now)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
