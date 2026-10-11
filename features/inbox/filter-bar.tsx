"use client";

import { Search, X } from "lucide-react";

import { CHANNELS, CHANNEL_LABELS, type ChannelId } from "@/lib/config";
import { channelDotClass } from "@/lib/domain/channel-visuals";
import {
  INBOX_VIEWS,
  INBOX_VIEW_LABELS,
  INTENT_OPTIONS,
  PRIORITY_OPTIONS,
  SENTIMENT_OPTIONS,
  SLA_OPTIONS,
  type InboxFilterOptions,
  type InboxLabeledOption,
  type InboxQuery,
} from "@/lib/domain/inbox";
import { cn } from "@/lib/utils";

import { DateFilter } from "@/features/inbox/date-filter";

/**
 * Inbox filter bar.
 *
 * The view presets (§15 work buckets), channel toggles and the dimension
 * dropdowns all feed straight into the query, so every control here changes
 * what the server returns. The bar is presentational; the view owns the state.
 */

export interface FilterBarProps {
  query: InboxQuery;
  options: InboxFilterOptions | null;
  onPatch: (patch: Partial<InboxQuery>) => void;
  onClear: () => void;
  onClearDates: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

function hasActiveFilters(query: InboxQuery): boolean {
  return (
    query.view !== "all" ||
    query.channels.length > 0 ||
    query.intent !== "" ||
    query.sentiment !== "" ||
    query.priority !== "" ||
    query.sla !== "" ||
    query.assigneeId !== "" ||
    query.teamId !== "" ||
    query.date !== "any" ||
    query.dateFrom !== "" ||
    query.dateTo !== "" ||
    query.search.trim() !== ""
  );
}

export function FilterBar({
  query,
  options,
  onPatch,
  onClear,
  onClearDates,
  searchValue,
  onSearchChange,
}: FilterBarProps) {
  const channelOptions: ReadonlyArray<InboxLabeledOption<ChannelId>> =
    options?.channels ?? CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABELS[channel] }));

  function toggleChannel(channel: ChannelId) {
    const channels = query.channels.includes(channel)
      ? query.channels.filter((candidate) => candidate !== channel)
      : [...query.channels, channel];
    onPatch({ channels });
  }

  const active = hasActiveFilters(query);

  return (
    <div className="border-line bg-surface flex flex-col gap-2.5 border-b px-3 py-3">
      <div role="tablist" aria-label="Inbox views" className="flex flex-wrap items-center gap-1">
        {INBOX_VIEWS.map((view) => {
          const selected = query.view === view;
          return (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onPatch({ view })}
              className={cn(
                "duration-fast rounded-md px-2.5 py-1 text-xs transition-colors",
                selected
                  ? "bg-primary-subtle text-primary-ink font-medium"
                  : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
              )}
            >
              {INBOX_VIEW_LABELS[view]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Channel filter">
        {channelOptions.map((option) => {
          const selected = query.channels.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleChannel(option.value)}
              className={cn(
                "duration-fast inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors",
                selected
                  ? "border-primary/50 bg-primary-subtle text-primary-ink font-medium"
                  : "border-line text-ink-secondary hover:bg-surface-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("size-1.5 rounded-full", channelDotClass(option.value))}
              />
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <label className="border-line bg-canvas flex h-8 min-w-[9rem] flex-1 items-center gap-1.5 rounded-md border px-2">
          <Search className="text-ink-muted size-3.5 shrink-0" aria-hidden="true" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="text-ink placeholder:text-ink-subtle min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>

        <FilterSelect
          label="Priority"
          value={query.priority}
          options={options?.priorities ?? PRIORITY_OPTIONS}
          onChange={(value) => onPatch({ priority: value as InboxQuery["priority"] })}
        />
        <FilterSelect
          label="SLA"
          value={query.sla}
          options={options?.slaStates ?? SLA_OPTIONS}
          onChange={(value) => onPatch({ sla: value as InboxQuery["sla"] })}
        />
        <details className="relative">
          <summary className="border-line bg-canvas inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs text-ink-secondary">
            More filters
          </summary>
          <div className="absolute right-0 z-40 mt-1 w-[14rem] rounded-lg border border-line bg-surface p-2 shadow-lg">
            <div className="flex flex-col gap-1.5">
              <FilterSelect
                label="Intent"
                value={query.intent}
                options={options?.intents ?? INTENT_OPTIONS}
                onChange={(value) => onPatch({ intent: value as InboxQuery["intent"] })}
              />
              <FilterSelect
                label="Sentiment"
                value={query.sentiment}
                options={options?.sentiments ?? SENTIMENT_OPTIONS}
                onChange={(value) => onPatch({ sentiment: value as InboxQuery["sentiment"] })}
              />
            </div>
          </div>
        </details>
        <FilterSelect
          label="Assigned"
          value={query.assigneeId}
          options={(options?.assignees ?? []).map((assignee) => ({
            value: assignee.id,
            label: assignee.name,
          }))}
          onChange={(value) => onPatch({ assigneeId: value })}
        />
        <FilterSelect
          label="Team"
          value={query.teamId}
          options={(options?.teams ?? []).map((team) => ({ value: team.id, label: team.name }))}
          onChange={(value) => onPatch({ teamId: value })}
        />
        <DateFilter query={query} onPatch={onPatch} onClearDates={onClearDates} />

        {active ? (
          <button
            type="button"
            onClick={onClear}
            className="text-ink-secondary hover:text-ink inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs"
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="border-line bg-canvas text-ink-secondary inline-flex h-8 items-center gap-1 rounded-md border pl-2 pr-1 text-xs">
      <span className="text-ink-subtle">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-ink max-w-[8.5rem] bg-transparent pr-1 text-xs outline-none"
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}