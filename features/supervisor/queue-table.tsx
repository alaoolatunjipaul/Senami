"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { FilterChipRow } from "@/features/supervisor/supervisor-primitives";
import { PriorityBadge, StatusBadge } from "@/features/supervisor/supervisor-primitives";
import { SLAIndicator } from "@/components/ui/sla-indicator";
import type { SupervisorQueueQuery, SupervisorQueueRowDto } from "@/lib/domain/supervisor";
import {
  QUEUE_ASSIGNMENT_LABELS,
  QUEUE_ESCALATION_LABELS,
  QUEUE_SORT_LABELS,
  QUEUE_STATUS_OPTIONS,
  SLA_FILTER_OPTIONS,
  hasActiveQueueFilters,
} from "@/lib/domain/supervisor";
import { PRIORITY_META } from "@/lib/domain/taxonomy";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";

/**
 * Supervisor queue table and toolbar.
 *
 * The table is deliberately dense and non-combobox-y: filters are chip rows,
 * which are scan-friendly for operations. Every time-based string is a relative
 * label but the underlying timestamp is still serialised server-side for
 * correctness; the UI only displays what the API already computed.
 */

export interface SupervisorQueueTableProps {
  readonly rows: readonly SupervisorQueueRowDto[];
  readonly query: SupervisorQueueQuery;
  readonly onQueryChange: (next: Partial<SupervisorQueueQuery>) => void;
  readonly onReset?: () => void;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly errorMessage: string | null;
  readonly total: number;
  readonly onRowSelect?: (id: string) => void;
  readonly selectedId?: string | null;
}

function SortIndicator({ direction }: { direction: "asc" | "desc" | null }) {
  if (direction === "asc") return <ChevronUp className="size-3.5" aria-hidden="true" />;
  if (direction === "desc") return <ChevronDown className="size-3.5" aria-hidden="true" />;
  return null;
}

export function SupervisorQueueTable({
  rows,
  query,
  onQueryChange,
  onReset,
  isLoading,
  isError,
  errorMessage,
  total,
  onRowSelect,
  selectedId,
}: SupervisorQueueTableProps) {
  const active = hasActiveQueueFilters(query);

  if (isLoading) {
    return <LoadingState label="Loading the live queue" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="The live queue could not be loaded"
        description={errorMessage ?? "Something went wrong while fetching conversations."}
        onRetry={() => onQueryChange({})}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={active ? "No conversations match these filters" : "Queue is clear"}
        description={
          active
            ? "Adjust filters to see more conversations, or clear them to reset the view."
            : "No open conversations are currently waiting for action."
        }
        action={active && onReset ? <Button onClick={onReset}>Clear filters</Button> : undefined}
      />
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="border-line flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-ink-muted text-xs">
          Showing <span data-numeric>{rows.length}</span> of <span data-numeric>{total}</span> conversations
        </p>
        <div className="text-ink-subtle flex items-center gap-2 text-xs">
          <span>Sort:</span>
          {Object.entries(QUEUE_SORT_LABELS).map(([value, label]) => {
            const v = value as SupervisorQueueQuery["sort"];
            return (
              <button
                key={v}
                type="button"
                onClick={() => onQueryChange({ sort: v })}
                className={cn(
                  "focus-visible:outline-primary inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-medium",
                  query.sort === v
                    ? "bg-surface-muted text-ink"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {label}
                <SortIndicator direction={query.sort === v ? "desc" : null} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="bg-surface-muted/40 text-ink-muted border-line border-b text-xs uppercase tracking-wide">
              <th scope="col" className="px-3 py-2 text-left">
                Conversation
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Customer
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Status
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Priority
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                SLA
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Assignee
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Age/Idle
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Last message
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const channelMeta = { emoji: "💬" } as const;
              const selected = selectedId === row.id;

              return (
                <tr
                  key={row.id}
                  onClick={() => onRowSelect?.(row.id)}
                  className={cn(
                    "border-line cursor-pointer border-b transition-colors hover:bg-surface-muted/50",
                    selected && "bg-primary-subtle/40",
                  )}
                >
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-lg leading-none" aria-hidden="true">
                        {channelMeta.emoji}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <Link
                          href={`/conversations/${row.id}`}
                          className="text-ink block truncate font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.id}
                        </Link>
                        <p className="text-ink-muted line-clamp-1 max-w-[320px] text-xs">{row.preview}</p>
                        <p className="text-ink-subtle text-[10px] uppercase tracking-wide">
                          {row.intent}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="min-w-0">
                      <p className="text-ink truncate font-medium">{row.customerName}</p>
                      <p className="text-ink-muted truncate text-xs">{row.customerHandle}</p>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={row.status} />
                      {row.escalated ? <Badge tone="critical">Escalated</Badge> : null}
                      {row.needsReview ? <Badge tone="warning">Needs QA</Badge> : null}
                      {row.slaPaused ? <Badge tone="neutral">SLA paused</Badge> : null}
                      {row.unread ? <Badge tone="info">Unread</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <SLAIndicator evaluation={row.sla as never} compact />
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.assigneeName ? (
                      <div className="min-w-0">
                        <p className="text-ink truncate text-xs font-medium">{row.assigneeName}</p>
                        <p className="text-ink-muted text-[10px] uppercase">{row.teamName ?? "—"}</p>
                      </div>
                    ) : (
                      <p className="text-ink-subtle text-xs">Unassigned</p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <p className="text-ink text-xs" data-numeric>
                      {Math.round(row.ageMinutes)}m age
                    </p>
                    <p className="text-ink-muted text-xs" data-numeric>
                      {Math.round(row.idleMinutes)}m idle
                    </p>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <p className="text-ink text-xs">{formatRelativeTime(row.lastMessageAt)}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

import { Badge } from "@/components/ui/badge";

export function QueueFilters({
  query,
  onQueryChange,
  onReset,
}: {
  query: SupervisorQueueQuery;
  onQueryChange: (next: Partial<SupervisorQueueQuery>) => void;
  onReset: () => void;
}) {
  const searchValue = query.search;

  return (
    <Card className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="text-ink-subtle absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden="true" />
          <Input
            value={searchValue}
            onChange={(e) => onQueryChange({ search: e.target.value, page: 1 })}
            placeholder="Search customer, handle, preview or ID"
            className="pl-7"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => onQueryChange({ search: "", page: 1 })}
              className="text-ink-subtle hover:text-ink absolute top-1/2 right-2 -translate-y-1/2"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Clear search</span>
            </button>
          ) : null}
        </div>
        {hasActiveQueueFilters(query) ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <FilterChipRow
        label="Status"
        options={QUEUE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={query.status}
        onChange={(v) => onQueryChange({ status: v as SupervisorQueueQuery["status"], page: 1 })}
      />
      <FilterChipRow
        label="Assignment"
        options={Object.entries(QUEUE_ASSIGNMENT_LABELS).map(([value, label]) => ({ value, label }))}
        value={query.assignment}
        onChange={(v) => onQueryChange({ assignment: v as SupervisorQueueQuery["assignment"], page: 1 })}
      />
      <FilterChipRow
        label="Escalation"
        options={Object.entries(QUEUE_ESCALATION_LABELS).map(([value, label]) => ({ value, label }))}
        value={query.escalation}
        onChange={(v) => onQueryChange({ escalation: v as SupervisorQueueQuery["escalation"], page: 1 })}
      />
      <FilterChipRow
        label="SLA"
        options={SLA_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={query.sla}
        onChange={(v) => onQueryChange({ sla: v as SupervisorQueueQuery["sla"], page: 1 })}
      />
      <FilterChipRow
        label="Priority"
        options={Object.entries(PRIORITY_META).map(([value, meta]) => ({ value, label: meta.label }))}
        value={query.priority}
        onChange={(v) => onQueryChange({ priority: v as SupervisorQueueQuery["priority"], page: 1 })}
      />
    </Card>
  );
}
