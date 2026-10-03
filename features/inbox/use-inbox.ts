"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  DEFAULT_PAGE_SIZE,
  type InboxConversationDto,
  type InboxListResponse,
  type InboxQuery,
} from "@/lib/domain/inbox";

/**
 * Inbox data access.
 *
 * Serialises an `InboxQuery` into the query string the API expects and exposes
 * the list query, a single-conversation query (for deep links) and the read
 * mutation. The query key is the serialised query itself, so any filter change
 * is a distinct cache entry and refetches precisely.
 */

export function inboxQueryToSearchParams(query: InboxQuery): string {
  const params = new URLSearchParams();
  params.set("view", query.view);
  for (const channel of query.channels) params.append("channel", channel);
  if (query.intent !== "") params.set("intent", query.intent);
  if (query.sentiment !== "") params.set("sentiment", query.sentiment);
  if (query.priority !== "") params.set("priority", query.priority);
  if (query.sla !== "") params.set("sla", query.sla);
  if (query.assigneeId !== "") params.set("assignee", query.assigneeId);
  if (query.teamId !== "") params.set("team", query.teamId);
  if (query.date !== "any") params.set("date", query.date);
  if (query.dateFrom !== "") params.set("from", query.dateFrom);
  if (query.dateTo !== "") params.set("to", query.dateTo);
  if (query.search.trim() !== "") params.set("q", query.search.trim());
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? DEFAULT_PAGE_SIZE));
  return params.toString();
}

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

export function useInboxList(query: InboxQuery) {
  const searchParams = useMemo(() => inboxQueryToSearchParams(query), [query]);

  return useQuery({
    queryKey: ["inbox", "list", searchParams],
    queryFn: () => fetchJson<InboxListResponse>(`/api/conversations?${searchParams}`),
    placeholderData: keepPreviousData,
  });
}

export function useInboxConversation(id: string | null) {
  return useQuery({
    queryKey: ["inbox", "conversation", id],
    enabled: id !== null,
    queryFn: async () => {
      const body = await fetchJson<{ conversation: InboxConversationDto }>(
        `/api/conversations/${encodeURIComponent(id as string)}`,
      );
      return body.conversation;
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      const response = await fetch(`/api/conversations/${encodeURIComponent(id)}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update the conversation (${response.status}).`);
      }
      return (await response.json()) as { ok: true; conversation: InboxConversationDto };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}