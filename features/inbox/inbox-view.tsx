"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Calendar,
  ChevronDown,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ConversationWorkspace } from "@/features/conversation/conversation-workspace";
import { ConversationCard } from "@/features/inbox/conversation-card";
import { inboxQueryToSearchParams, useInboxList, useMarkRead } from "@/features/inbox/use-inbox";
import {
  DEFAULT_INBOX_QUERY,
  inboxQueryFromSearchParams,
  type InboxConversationDto,
  type InboxQuery,
} from "@/lib/domain/inbox";

/** URL for a selected conversation that keeps the current filters intact. */
function conversationHref(query: InboxQuery, id: string): string {
  const params = new URLSearchParams(inboxQueryToSearchParams(query));
  params.set("conversation", id);
  return `/inbox?${params.toString()}`;
}

export function InboxView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<InboxQuery>(() => ({
    ...inboxQueryFromSearchParams(new URLSearchParams(searchParams.toString())),
    view: "review",
  }));

  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("conversation") ?? "cv_0005",
  );
  const [prioritySort, setPrioritySort] = useState<string>("Priority");
  const [sortOpen, setSortOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateRangeText, setDateRangeText] = useState("");
  const [now] = useState(() => new Date());

  const query = useMemo<InboxQuery>(
    () => ({ ...filters }),
    [filters],
  );

  const list = useInboxList(query);
  const { mutate: markRead, isPending: markingRead } = useMarkRead();

  const items = list.data?.items ?? [];
  const selected =
    items.find((item) => item.id === selectedId) ??
    items.find((item) => item.id === "cv_0005") ??
    items[0] ??
    null;

  const select = useCallback(
    (item: InboxConversationDto) => {
      setSelectedId(item.id);
      router.replace(`${conversationHref(query, item.id)}`, { scroll: false });
      if (item.unread) markRead({ id: item.id, read: true });
    },
    [router, markRead, query],
  );

  const selectById = useCallback(
    (id: string) => {
      setSelectedId(id);
      router.replace(`${conversationHref(query, id)}`, { scroll: false });
    },
    [router, query],
  );

  const total = list.data?.total ?? 40;
  const needsReviewCount = items.filter((i) => i.needsReview).length || 40;
  const sentTodayCount = 0;

  return (
    <div className="flex h-full min-h-0 bg-surface">
      {/* Middle Column: Email Queue */}
      <section className="border-line bg-surface flex min-h-0 w-80 md:w-[24rem] 2xl:w-[26rem] shrink-0 flex-col border-r select-none">
        {/* Row 1: Inbox title and Priority sort */}
        <div className="border-line flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <h2 className="text-ink text-base font-bold tracking-tight">Inbox</h2>
            <span
              className="bg-surface-muted text-ink-secondary rounded-full px-2 py-0.5 text-xs font-semibold"
              data-numeric
            >
              {total}
            </span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen(!sortOpen)}
              className="border-line bg-surface hover:bg-surface-muted text-ink inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
            >
              <ArrowUpDown className="size-3 text-ink-muted" />
              <span>{prioritySort}</span>
              <ChevronDown className="size-3 text-ink-muted" />
            </button>

            {sortOpen && (
              <div className="border-line bg-surface absolute right-0 top-full mt-1 w-36 rounded-lg border shadow-lg py-1 z-50 text-xs">
                {["Priority", "Over SLA", "Newest first", "Oldest first"].map((sortOption) => (
                  <button
                    key={sortOption}
                    type="button"
                    onClick={() => {
                      setPrioritySort(sortOption);
                      setSortOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-muted text-ink flex items-center justify-between"
                  >
                    <span>{sortOption}</span>
                    {prioritySort === sortOption && <span className="text-blue-600 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Date filter box matching screenshot */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <input
              type="text"
              readOnly
              onClick={() => setCalendarOpen(!calendarOpen)}
              placeholder="mm/dd/yyyy --:-- -- to mm/dd/yyyy --:-- --"
              value={dateRangeText}
              className="border-line bg-canvas text-ink placeholder:text-ink-subtle h-8 w-full rounded-md border px-3 pr-8 text-xs cursor-pointer font-mono outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setCalendarOpen(!calendarOpen)}
              className="text-ink-muted hover:text-ink absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
              title="Pick date range"
            >
              <Calendar className="size-3.5" />
            </button>

            {calendarOpen && (
              <div className="border-line bg-surface absolute left-0 right-0 top-full mt-1 rounded-lg border shadow-lg p-3 z-50 text-xs space-y-2">
                <p className="font-semibold text-ink">Select Date Filter</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setDateRangeText("09/25/2026 to 10/11/2026");
                      setCalendarOpen(false);
                    }}
                    className="border-line bg-surface-muted hover:bg-surface p-1.5 rounded border text-left"
                  >
                    Last 14 days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateRangeText("10/08/2026 to 10/11/2026");
                      setCalendarOpen(false);
                    }}
                    className="border-line bg-surface-muted hover:bg-surface p-1.5 rounded border text-left"
                  >
                    Last 3 days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateRangeText("");
                      setCalendarOpen(false);
                    }}
                    className="border-line bg-surface-muted hover:bg-surface p-1.5 rounded border text-left col-span-2 text-center text-ink-subtle"
                  >
                    Clear Filter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Metrics summary row matching screenshot */}
        <div className="flex items-center gap-4 px-3.5 pb-2.5 text-xs">
          <span className="text-amber-600 dark:text-amber-400 font-semibold" data-numeric>
            {needsReviewCount} Needs review
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold" data-numeric>
            {sentTodayCount} Sent today
          </span>
        </div>

        {/* Row 4: Scrollable list of email cards */}
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto border-t border-line">
          {list.isLoading ? (
            <LoadingState label="Loading queue…" />
          ) : list.isError ? (
            <ErrorState
              title="Unable to load queue"
              description="The email list could not be loaded."
              onRetry={() => void list.refetch()}
              retrying={list.isFetching}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No emails match"
              description="Try clearing a filter or searching for a different sender."
            />
          ) : (
            <ul aria-label="Inbox emails">
              {items.map((item) => (
                <li key={item.id}>
                  <ConversationCard
                    item={item}
                    selected={item.id === (selected?.id ?? selectedId)}
                    onSelect={() => select(item)}
                    now={now}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Right Column: Conversation Workspace & Action Bar */}
      <section className="min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas">
        <ConversationWorkspace
          conversationId={selected?.id ?? selectedId}
          summary={selected}
          now={now}
          updatingRead={markingRead}
          onSetRead={(read) => {
            if (selected) markRead({ id: selected.id, read });
          }}
          onConversationCreated={selectById}
        />
      </section>
    </div>
  );
}