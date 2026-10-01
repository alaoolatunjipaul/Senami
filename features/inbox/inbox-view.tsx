"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ConversationCard } from "@/features/inbox/conversation-card";
import { ConversationPane } from "@/features/inbox/conversation-pane";
import { FilterBar } from "@/features/inbox/filter-bar";
import { useInboxConversation, useInboxList, useMarkRead } from "@/features/inbox/use-inbox";
import {
  DEFAULT_INBOX_QUERY,
  DEFAULT_PAGE_SIZE,
  type InboxConversationDto,
  type InboxQuery,
} from "@/lib/domain/inbox";

/**
 * Inbox view.
 *
 * Owns the filter state, the list query, the selected conversation and the
 * read mutation. The list and the detail pane are wired together through real
 * state: selecting a card updates the pane and the URL (so global-search deep
 * links resolve), and marking read mutates the store and refetches.
 */

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
    query.search.trim() !== ""
  );
}

export function InboxView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<InboxQuery>(() => ({ ...DEFAULT_INBOX_QUERY }));
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("conversation"));
  const [now] = useState(() => new Date());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo<InboxQuery>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const list = useInboxList(query);
  const { mutate: markRead, isPending: markingRead } = useMarkRead();

  const items = list.data?.items ?? [];
  const listItem = items.find((item) => item.id === selectedId) ?? null;
  // A conversation can be deep-linked from outside the current page or filter;
  // fetch it directly so the pane always has something real to show.
  const single = useInboxConversation(listItem === null ? selectedId : null);
  const selected = listItem ?? single.data ?? null;

  const updateFilters = useCallback((patch: Partial<InboxQuery>) => {
    setFilters((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_INBOX_QUERY });
    setSearchInput("");
    setDebouncedSearch("");
  }, []);

  const select = useCallback(
    (item: InboxConversationDto) => {
      setSelectedId(item.id);
      router.replace(`/inbox?conversation=${item.id}`, { scroll: false });
      if (item.unread) markRead({ id: item.id, read: true });
    },
    [router, markRead],
  );

  const total = list.data?.total ?? 0;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-full min-h-0">
      <section className="border-line bg-surface flex min-h-0 w-[24rem] max-w-[45%] shrink-0 flex-col border-r">
        <FilterBar
          query={filters}
          options={list.data?.options ?? null}
          onPatch={updateFilters}
          onClear={clearFilters}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
        />

        <div className="border-line flex shrink-0 items-center justify-between border-b px-3 py-2">
          <p className="text-ink-secondary text-xs font-medium" data-numeric>
            {total} {total === 1 ? "conversation" : "conversations"}
          </p>
          {hasActiveFilters(query) ? (
            <span className="text-ink-subtle text-[11px]">Filtered</span>
          ) : null}
        </div>

        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
          {list.isLoading ? (
            <LoadingState label="Loading conversations…" />
          ) : list.isError ? (
            <ErrorState
              title="Unable to load the inbox"
              description="The conversation list could not be loaded. The problem has been logged."
              onRetry={() => void list.refetch()}
              retrying={list.isFetching}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No conversations match"
              description="Try clearing a filter or searching for a different customer."
            />
          ) : (
            <ul aria-label="Conversations">
              {items.map((item) => (
                <li key={item.id}>
                  <ConversationCard
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={() => select(item)}
                    now={now}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-line flex shrink-0 items-center justify-between border-t px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateFilters({ page: page - 1 })}
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Prev
          </Button>
          <span className="text-ink-subtle text-[11px]" data-numeric>
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => updateFilters({ page: page + 1 })}
          >
            Next
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <section className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ConversationPane
          item={selected}
          now={now}
          updating={markingRead}
          onSetRead={(read) => {
            if (selected) markRead({ id: selected.id, read });
          }}
        />
      </section>
    </div>
  );
}