"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Minus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AGENT_PRESENCE_META, type AgentPresence } from "@/lib/domain/supervisor";
import type { SupervisorKpi } from "@/lib/domain/supervisor-kpi";
import { CONVERSATION_STATUS_META, PRIORITY_META, type ConversationStatus, type Priority } from "@/lib/domain/taxonomy";
import type { PerformanceDay } from "@/lib/domain/performance";
import { cn } from "@/lib/utils";

/**
 * Shared supervisor console pieces.
 *
 * Small enough that each one is obvious, shared enough that a badge, a tile or a
 * utilisation bar cannot drift between the queue, the team view and the dashboard.
 * Every figure rendered here arrives pre-formatted from the server: nothing in the
 * console recomputes a count or a countdown in the browser (§24, §38).
 */

/* -------------------------------------------------------------------------
 * KPI tiles
 * ---------------------------------------------------------------------- */

export function KpiTile({ kpi }: { kpi: SupervisorKpi }) {
  return (
    <Card className="p-3 transition-colors hover:border-line-strong">
      <Link href={kpi.href} className="group block focus-visible:outline-primary rounded-sm">
        <p className="text-ink-muted text-xs">{kpi.label}</p>
        <p
          data-numeric
          className={cn(
            "mt-1 text-xl font-semibold tracking-tight",
            kpi.tone === "critical" && "text-critical",
            kpi.tone === "warning" && "text-warning",
            kpi.tone === "success" && "text-success",
            "text-ink",
          )}
        >
          {kpi.display}
        </p>
        <p className="text-ink-subtle mt-0.5 text-xs group-hover:text-ink-muted">{kpi.hint}</p>
      </Link>
    </Card>
  );
}

export function KpiGrid({ kpis }: { kpis: readonly SupervisorKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {kpis.map((kpi) => (
        <KpiTile key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Presence & workload
 * ---------------------------------------------------------------------- */

export function PresenceBadge({ presence }: { presence: AgentPresence }) {
  const meta = AGENT_PRESENCE_META[presence];

  return (
    <Badge tone={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}

/**
 * Capacity bar.
 *
 * `aria-valuenow` is the raw load against capacity, not the clamped bar width, so
 * a screen reader announces "9 of 6" for an overloaded agent rather than the
 * visually honest 100%.
 */
export function UtilisationBar({
  load,
  capacity,
  className,
}: {
  load: number;
  capacity: number;
  className?: string;
}) {
  const over = load > capacity;
  const safe = Math.min(100, Math.round((load / Math.max(capacity, 1)) * 100));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={capacity}
      aria-valuenow={load}
      aria-valuetext={`${load} of ${capacity} conversations`}
      className={cn("bg-surface-muted h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("h-full rounded-full", over ? "bg-critical" : safe > 75 ? "bg-warning" : "bg-primary")}
        style={{ width: `${Math.max(safe, load > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Conversation badges
 * ---------------------------------------------------------------------- */

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const meta = CONVERSATION_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge tone={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}

/* -------------------------------------------------------------------------
 * Filter chips
 * ---------------------------------------------------------------------- */

export interface FilterChipOption {
  readonly value: string;
  readonly label: string;
  readonly count?: number;
}

export function FilterChipRow({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly FilterChipOption[];
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-visible:outline-primary rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary-subtle text-primary"
                : "border-line text-ink-muted hover:bg-surface-muted hover:text-ink",
            )}
          >
            {option.label}
            {option.count === undefined ? null : (
              <span data-numeric className="ml-1 opacity-70">
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Trend bars
 * ---------------------------------------------------------------------- */

/**
 * Compact daily volume chart.
 *
 * Rendered as a labelled list rather than an SVG chart: the values matter more
 * than the shape, and every bar carries its own accessible value so the series is
 * readable without seeing it.
 */
export function TrendBars({ days, label }: { days: readonly PerformanceDay[]; label: string }) {
  const peak = days.reduce((max, day) => Math.max(max, day.handled), 0);

  if (peak === 0) {
    return <p className="text-ink-subtle px-3 py-4 text-xs">No activity in this window.</p>;
  }

  return (
    <div>
      <ul aria-label={label} className="flex h-16 items-end gap-1 px-3 pb-1">
        {days.map((day) => {
          const height = Math.max(3, Math.round((day.handled / peak) * 100));
          return (
            <li key={day.date} className="flex-1">
              <div
                title={`${day.label}: ${day.handled} handled, ${day.resolved} resolved`}
                className="bg-primary/70 hover:bg-primary w-full rounded-sm"
                style={{ height: `${height}%` }}
              />
            </li>
          );
        })}
      </ul>
      <div className="text-ink-subtle flex justify-between px-3 pb-2 text-[10px]">
        <span>{days[0]?.label}</span>
        <span>Peak {peak}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Decision affordances
 * ---------------------------------------------------------------------- */

const DECISION_ICONS = { pass: Check, fail: X, not_applicable: Minus } as const;

/**
 * Outcome toggle used by the QA checklist.
 *
 * A radio group rather than three buttons: exactly one outcome is true per check,
 * and a screen reader should say so.
 */
export function OutcomeToggle({
  checkId,
  label,
  value,
  onChange,
  options,
  error,
}: {
  checkId: string;
  label: string;
  value: string | undefined;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly tone: string }>;
  error?: string;
}) {
  return (
    <fieldset
      className="border-line rounded-md border p-3"
      aria-describedby={error ? `${checkId}-error` : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="text-ink px-1 text-xs font-medium">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const Icon = DECISION_ICONS[option.value as keyof typeof DECISION_ICONS] ?? Minus;
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "focus-visible:outline-primary inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-medium transition-colors",
                selected
                  ? option.tone === "success"
                    ? "border-success bg-success-subtle text-success"
                    : option.tone === "critical"
                      ? "border-critical bg-critical-subtle text-critical"
                      : "border-line-strong bg-surface-muted text-ink"
                  : "border-line text-ink-muted hover:bg-surface-muted",
              )}
            >
              <Icon className="size-3" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={`${checkId}-error`} role="alert" className="text-critical mt-1.5 text-xs">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/* -------------------------------------------------------------------------
 * Notice strip
 * ---------------------------------------------------------------------- */

/** Used for the "these figures are measured from X" provenance note. */
export function ProvenanceNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-ink-subtle border-line bg-surface-muted rounded-md border border-dashed px-3 py-2 text-xs">
      {children}
    </p>
  );
}
