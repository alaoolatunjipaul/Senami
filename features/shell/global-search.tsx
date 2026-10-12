"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CornerDownLeft, Search, Sparkles } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SearchResultItem, SearchResultGroup } from "@/lib/domain/search";
import { cn } from "@/lib/utils";

/**
 * Global search (§13).
 *
 * Debounced, grouped (users, conversations, cases) and keyboard navigable.
 * The data source is injected so the shell ships independently of the backend;
 * results are grouped and open directly. The result shape lives in
 * `lib/domain/search.ts` so the server provider shares one contract.
 */

export type { SearchResultItem, SearchResultGroup } from "@/lib/domain/search";

export interface GlobalSearchProps {
  /** Pure lookup; debouncing and grouping are handled internally. */
  search: (query: string) => Promise<readonly SearchResultGroup[]> | readonly SearchResultGroup[];
  /** Called with a result href instead of performing a full navigation. */
  onNavigate?: (href: string) => void;
  debounceMs?: number;
  minQuery?: number;
  placeholder?: string;
  className?: string;
}

type SearchState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "results"; readonly groups: readonly SearchResultGroup[] }
  | { readonly status: "empty"; readonly query: string }
  | { readonly status: "error" };

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MIN_QUERY = 2;

export function GlobalSearch({
  search,
  onNavigate,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minQuery = DEFAULT_MIN_QUERY,
  placeholder = "Search Interaction ID, customer, handle, or message…",
  className,
}: GlobalSearchProps) {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);

  const groups = state.status === "results" ? state.groups : [];
  const flattened = groups.flatMap((group) => group.items.map((item) => ({ group, item })));
  const indexById = new Map(flattened.map((entry, index) => [entry.item.id, index]));
  const flatItems = flattened.map((entry) => entry.item);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleChange(value: string) {
    setQuery(value);
    setActiveIndex(-1);
    clearTimer();

    if (value.trim().length < minQuery) {
      setOpen(value.trim().length > 0);
      setState({ status: "idle" });
      return;
    }

    setOpen(true);
    setState({ status: "loading" });
    timerRef.current = setTimeout(() => {
      void run(value);
    }, debounceMs);
  }

  async function run(value: string) {
    const runId = ++runIdRef.current;
    try {
      const groups = await search(value.trim());
      if (runId !== runIdRef.current) return;
      const visible = groups.filter((group) => group.items.length > 0);
      setState(
        visible.length === 0
          ? { status: "empty", query: value.trim() }
          : { status: "results", groups: visible },
      );
    } catch {
      if (runId !== runIdRef.current) return;
      setState({ status: "error" });
    }
  }

  function close() {
    clearTimer();
    runIdRef.current += 1;
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      if (flatItems.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const next = (current + delta + flatItems.length) % flatItems.length;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0 && activeIndex < flatItems.length) {
      event.preventDefault();
      const target = flatItems[activeIndex];
      if (target === undefined) return;
      select(target.href);
      return;
    }

    if (event.key === "Escape") close();
  }

  function select(href: string) {
    close();
    if (onNavigate) {
      onNavigate(href);
    } else {
      window.location.assign(href);
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <Search
            className="text-ink-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? "global-search-results" : undefined}
            aria-activedescendant={
              activeIndex >= 0 && activeIndex < flatItems.length
                ? `search-result-${flatItems[activeIndex]?.id}`
                : undefined
            }
            aria-autocomplete="list"
            placeholder={placeholder}
            value={query}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={onKeyDown}
            onClick={() => query.trim().length >= minQuery && setOpen(true)}
            className={cn(
              "border-line bg-canvas text-ink placeholder:text-ink-subtle h-9 w-full rounded-md border pr-14 pl-8 text-sm",
              "duration-fast focus:border-primary focus:ring-primary/30 transition-colors outline-none focus:ring-[3px]",
            )}
          />
          <kbd
            aria-hidden="true"
            className="text-ink-subtle border-line pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] sm:block"
          >
            /
          </kbd>
        </div>
      </PopoverTrigger>

      <PopoverContent
        id="global-search-results"
        align="start"
        sideOffset={8}
        className="w-[min(32rem,calc(100vw-2rem))] p-0"
      >
        {state.status === "idle" ? (
          <SearchHint />
        ) : state.status === "loading" ? (
          <div
            role="status"
            aria-live="polite"
            className="text-ink-muted flex items-center gap-2 px-4 py-4 text-xs"
          >
            <Sparkles className="size-3.5 animate-pulse" aria-hidden="true" />
            Searching…
          </div>
        ) : state.status === "error" ? (
          <div role="alert" className="text-critical px-4 py-4 text-xs">
            Search failed. Try again in a moment.
          </div>
        ) : state.status === "empty" ? (
          <div className="flex flex-col gap-1 px-4 py-6 text-center">
            <p className="text-ink text-sm font-medium">No results for “{state.query}”</p>
            <p className="text-ink-muted text-xs">
              Try a customer name, a conversation topic or a case reference.
            </p>
          </div>
        ) : (
          <div className="scrollbar-slim max-h-[24rem] overflow-y-auto">
            {groups.map((group) => (
              <section key={group.id} aria-label={group.label}>
                <h3 className="text-ink-subtle bg-surface/95 sticky top-0 px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase backdrop-blur">
                  {group.label}
                </h3>
                <ul role="listbox">
                  {group.items.map((item) => {
                    const index = indexById.get(item.id) ?? -1;
                    const selected = index === activeIndex;
                    return (
                      <li
                        key={item.id}
                        role="option"
                        aria-selected={selected}
                        id={`search-result-${item.id}`}
                      >
                        <SearchLink
                          item={item}
                          selected={selected}
                          onSelect={() => select(item.href)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div className="border-line text-ink-subtle flex items-center gap-3 border-t px-3 py-1.5 text-[10px]">
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="size-3" aria-hidden="true" />
                open
              </span>
              <span>↑↓ navigate · esc close</span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SearchHint() {
  return (
    <div className="text-ink-muted flex items-center gap-2 px-4 py-4 text-xs">
      <Search className="size-3.5" aria-hidden="true" />
      <span>
        Type to search customers, conversations and cases... Results are grouped and open directly.
      </span>
    </div>
  );
}

function SearchLink({
  item,
  selected,
  onSelect,
}: {
  item: SearchResultItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
        selected ? "bg-primary-subtle text-primary-ink" : "text-ink-secondary",
      )}
    >
      <span className="line-clamp-1 min-w-0 flex-1">
        <span className="block truncate font-medium">{item.label}</span>
        {item.sublabel ? (
          <span className="text-ink-muted block truncate text-xs">{item.sublabel}</span>
        ) : null}
      </span>
      {selected ? (
        <span className="shrink-0" aria-hidden="true">
          <CornerDownLeft className="text-primary size-3.5" />
        </span>
      ) : null}
    </Link>
  );
}
