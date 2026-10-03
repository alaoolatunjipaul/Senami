"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

import {
  DATE_PRESET_LABELS,
  describeDateSelection,
  toIsoDate,
  type DatePreset,
  type InboxQuery,
} from "@/lib/domain/inbox";
import { cn } from "@/lib/utils";

/**
 * Interaction date filter.
 *
 * The primary control is a real month calendar so an agent can open any single
 * calendar day (for example 18 September 2026). The shortcut list is secondary:
 * it maps onto the same query fields so every option is real filtering, never a
 * visual affordance. Selecting a day writes `dateFrom`/`dateTo` (a single day is
 * a one-day range) and switches the preset to "custom"; the server then resolves
 * the window through the same helpers the domain tests use.
 */

const SHORTCUT_PRESETS: readonly DatePreset[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
];

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export interface DateFilterProps {
  query: InboxQuery;
  onPatch: (patch: Partial<InboxQuery>) => void;
  onClearDates: () => void;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

/** Monday-first grid of the month containing `month`, padded to whole weeks. */
function monthGrid(month: Date): readonly (Date | null)[] {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let index = 0; index < offset; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DateFilter({ query, onPatch, onClearDates }: DateFilterProps) {
  const selected = query.dateFrom !== "" ? query.dateFrom : query.dateTo;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = describeDateSelection(query);
  const active = query.date !== "any" || selected !== "";

  function toggle() {
    // Opening on the currently selected month means the calendar never appears
    // on an unrelated month, without needing an effect to correct it.
    if (!open && selected !== "") {
      const parsed = new Date(`${selected}T00:00:00.000`);
      if (!Number.isNaN(parsed.getTime())) setMonth(startOfMonth(parsed));
    }
    setOpen(!open);
  }

  function pickShortcut(preset: DatePreset) {
    onPatch({ date: preset, dateFrom: "", dateTo: "" });
  }

  function pickDay(day: Date) {
    const iso = toIsoDate(day);
    // A second click on the other end of the range completes it; clicking the
    // same day again narrows the selection back to that single day.
    if (query.dateFrom !== "" && query.dateTo === "") {
      const from = query.dateFrom <= iso ? query.dateFrom : iso;
      const to = query.dateFrom <= iso ? iso : query.dateFrom;
      onPatch({ date: "custom", dateFrom: from, dateTo: to });
      return;
    }
    onPatch({ date: "custom", dateFrom: iso, dateTo: iso });
  }

  const cells = monthGrid(month);
  const todayIso = toIsoDate(new Date());

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        className={cn(
          "duration-fast border-line bg-canvas inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
          active ? "border-primary/50 bg-primary-subtle text-primary-ink font-medium" : "text-ink-secondary",
        )}
      >
        <CalendarDays className="size-3.5" aria-hidden="true" />
        {label}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter interactions by date"
          className="border-line bg-surface absolute right-0 z-40 mt-1 w-[19rem] rounded-lg border p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth((value) => addMonths(value, -1))}
              className="text-ink-secondary hover:bg-surface-muted hover:text-ink rounded p-1"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="text-ink text-xs font-medium">
              {month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth((value) => addMonths(value, 1))}
              className="text-ink-secondary hover:bg-surface-muted hover:text-ink rounded p-1"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAY_LABELS.map((weekday) => (
              <span key={weekday} className="text-ink-subtle text-center text-[10px]">
                {weekday}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, index) => {
              if (day === null) return <span key={`pad-${index}`} />;
              const iso = toIsoDate(day);
              const isStart = query.dateFrom === iso;
              const isEnd = query.dateTo === iso;
              const inRange =
                query.dateFrom !== "" &&
                query.dateTo !== "" &&
                iso > query.dateFrom &&
                iso < query.dateTo;
              return (
                <button
                  key={iso}
                  type="button"
                  aria-pressed={isStart || isEnd}
                  onClick={() => pickDay(day)}
                  className={cn(
                    "duration-fast h-7 rounded text-xs transition-colors",
                    inRange
                      ? "bg-primary-subtle text-primary-ink"
                      : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
                    isStart || isEnd ? "bg-primary text-primary-contrast font-medium" : "",
                    iso === todayIso && !isStart && !isEnd ? "ring-primary/40 ring-1" : "",
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-line grid grid-cols-2 gap-1 border-t pt-2">
            {SHORTCUT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => pickShortcut(preset)}
                className={cn(
                  "duration-fast rounded px-2 py-1 text-left text-xs transition-colors",
                  query.date === preset && selected === ""
                    ? "bg-primary-subtle text-primary-ink font-medium"
                    : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
                )}
              >
                {DATE_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>

          {active ? (
            <button
              type="button"
              onClick={() => {
                onClearDates();
                setOpen(false);
              }}
              className="text-ink-secondary hover:text-ink mt-2 inline-flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-xs"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear date filter
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}