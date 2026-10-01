"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { CHANNEL_LABELS } from "@/lib/config";
import { formatRelativeTime } from "@/lib/format";
import type { AgentActivityDto, AgentDashboardDto, AgentTile } from "@/lib/domain/agent";
import { cn } from "@/lib/utils";
import { useAgentDashboard } from "@/features/agent/use-agent-dashboard";

/**
 * Agent workspace dashboard (§10).
 *
 * Three things an agent needs on arrival: what is waiting for them, how they are
 * doing, and what they already did today. Each tile deep-links into the inbox
 * pre-filtered to exactly that bucket, so the count and the list can never
 * disagree.
 */

function TileCard({ tile }: { tile: AgentTile }) {
  return (
    <Link
      href={tile.href}
      className={cn(
        "group border-line hover:border-ink/20 bg-surface rounded-lg border p-4 transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
      data-testid={`agent-tile-${tile.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-muted text-xs font-medium">{tile.label}</p>
        <Badge tone={tile.tone}>{tile.count}</Badge>
      </div>
      <p className="text-ink mt-2 text-2xl font-semibold tabular-nums">{tile.count}</p>
      <p className="text-ink-muted mt-1 text-xs">{tile.description}</p>
      <span className="text-ink-muted group-hover:text-ink mt-3 inline-flex items-center gap-1 text-xs font-medium">
        Open
        <ArrowRight className="size-3" aria-hidden="true" />
      </span>
    </Link>
  );
}

function ActivityRow({ entry }: { entry: AgentActivityDto }) {
  return (
    <li className="border-line flex items-start justify-between gap-3 border-b py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-ink truncate text-xs font-medium">{entry.summary}</p>
        <p className="text-ink-muted mt-0.5 truncate text-xs">
          {entry.customerName} · {CHANNEL_LABELS[entry.channel]}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={entry.tone}>{entry.kind.replace(/_/g, " ")}</Badge>
        <time className="text-ink-muted text-xs" dateTime={entry.at}>
          {formatRelativeTime(entry.at)}
        </time>
      </div>
    </li>
  );
}

function TrendStrip({ dashboard }: { dashboard: AgentDashboardDto }) {
  const peak = Math.max(1, ...dashboard.trend.map((point) => point.firstResponseMinutes));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>First-response trend</CardTitle>
          <p className="text-ink-muted mt-1 text-xs">
            {dashboard.trendIsSeeded
              ? "Demonstration trend - seeded from the demo dataset, not measured history."
              : "Measured from your replies."}
          </p>
        </div>
        <TrendingUp className="text-ink-muted size-4" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <ul className="flex items-end justify-between gap-2">
          {dashboard.trend.map((point) => (
            <li key={point.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-ink-muted text-[10px] tabular-nums">{point.firstResponseMinutes}m</span>
              <span
                className="bg-ai/30 border-ai/40 w-full rounded-sm border"
                style={{ height: `${Math.max(8, Math.round((point.firstResponseMinutes / peak) * 56))}px` }}
                aria-hidden="true"
              />
              <span className="text-ink-muted text-[10px]">{point.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AgentDashboardView() {
  const { data, isPending, isError, refetch, isFetching } = useAgentDashboard();

  if (isPending) {
    return <LoadingState label="Loading your workspace" />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Your workspace could not be loaded"
        description="The dashboard request failed. Your conversations are unaffected."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="scrollbar-slim h-full space-y-6 overflow-y-auto p-6" data-testid="agent-dashboard">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-ink text-lg font-semibold">Good to see you, {data.agent.name.split(" ")[0]}</h2>
          <p className="text-ink-muted mt-1 text-sm">
            {data.tiles.find((tile) => tile.id === "assigned")?.count ?? 0} conversations assigned to you ·{" "}
            {data.tiles.find((tile) => tile.id === "unassigned")?.count ?? 0} waiting to be claimed
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-ink-muted hover:text-ink text-xs font-medium"
          disabled={isFetching}
        >
          {isFetching ? "Refreshing" : "Refresh"}
        </button>
      </header>

      <section aria-labelledby="agent-tiles-heading">
        <h3 id="agent-tiles-heading" className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
          Your queue
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.tiles.map((tile) => (
            <TileCard key={tile.id} tile={tile} />
          ))}
        </div>
      </section>

      <section aria-labelledby="agent-metrics-heading">
        <h3 id="agent-metrics-heading" className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
          Response metrics
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.metrics.map((metric) => (
            <Card key={metric.id} data-testid={`agent-metric-${metric.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-ink-muted text-xs font-medium">{metric.label}</p>
                  <Badge tone={metric.tone} size="sm">
                    {metric.value}
                  </Badge>
                </div>
                <p className="text-ink mt-2 text-xl font-semibold tabular-nums">{metric.value}</p>
                <div className="bg-surface-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-ink/40 h-full rounded-full"
                    style={{ width: `${Math.round(metric.ratio * 100)}%` }}
                    aria-hidden="true"
                  />
                </div>
                <p className="text-ink-muted mt-2 text-xs">{metric.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Today&apos;s activity</CardTitle>
            <p className="text-ink-muted mt-1 text-xs">
              {data.today.repliesSent} replies · {data.today.notesAdded} notes ·{" "}
              {data.today.conversationsResolved} resolved · {data.today.escalationsRaised} escalations
            </p>
          </CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <EmptyState
                title="Nothing logged yet today"
                description="Replies, notes, escalations and resolutions appear here as you work."
              />
            ) : (
              <ul>
                {data.activity.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <TrendStrip dashboard={data} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-ai size-4" aria-hidden="true" />
                AI assistance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-ink-muted text-xs">
                {data.today.aiSuggestionsUsed} suggestion{data.today.aiSuggestionsUsed === 1 ? "" : "s"} used
                today. Every AI output is a draft you edit and send yourself - Senami never sends on your behalf.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}