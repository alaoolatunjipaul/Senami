"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { AiAction, AiSuggestionDto } from "@/lib/domain/ai";
import type { CustomerContextDto } from "@/lib/domain/customer";
import type {
  AuditEventDto,
  ConversationMessageDto,
  CustomerHistoryDto,
  EscalationReason,
  MessageAttachment,
} from "@/lib/domain/conversation";
import type { InboxConversationDto } from "@/lib/domain/inbox";

/**
 * Conversation workspace data access.
 *
 * Every operation goes through the real API routes; nothing is faked on the
 * client. Query keys are namespaced under `["conversation", id, ...]` so a
 * mutation can invalidate exactly the affected conversation, and the inbox list
 * is invalidated separately so the queue reflects replies and assignments.
 */

export interface ConversationDetail {
  conversation: InboxConversationDto;
  thread: {
    type: "public" | "private";
    originConversationId: string | null;
    movedToConversationId: string | null;
    assignees: readonly {
      id: string;
      name: string;
      teamId: string;
      teamName: string;
    }[];
  };
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error bodies fall back to the status message.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** A ticking clock so SLA countdowns stay honest without hard-coded values. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

export function useConversationDetail(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id, "detail"],
    enabled: id !== null,
    queryFn: () =>
      requestJson<ConversationDetail>(`/api/conversations/${encodeURIComponent(id as string)}`),
  });
}

export function useConversationMessages(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id, "messages"],
    enabled: id !== null,
    queryFn: () =>
      requestJson<{ messages: readonly ConversationMessageDto[] }>(
        `/api/conversations/${encodeURIComponent(id as string)}/messages`,
      ),
  });
}

export function useConversationAudit(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id, "audit"],
    enabled: id !== null,
    queryFn: () =>
      requestJson<{ events: readonly AuditEventDto[] }>(
        `/api/conversations/${encodeURIComponent(id as string)}/audit`,
      ),
  });
}

export function useCustomerHistory(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id, "history"],
    enabled: id !== null,
    queryFn: () =>
      requestJson<CustomerHistoryDto>(`/api/conversations/${encodeURIComponent(id as string)}/history`),
  });
}

export interface SendMessageVariables {
  kind: "public" | "private" | "internal_note";
  body: string;
  attachments: readonly MessageAttachment[];
  clientRequestId: string;
}

function useInvalidateConversation(id: string | null) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
    void queryClient.invalidateQueries({ queryKey: ["inbox"] });
  };
}

export function useSendMessage(id: string | null) {
  const invalidate = useInvalidateConversation(id);
  return useMutation({
    mutationFn: (variables: SendMessageVariables) =>
      requestJson<{
        message: ConversationMessageDto;
        conversation: InboxConversationDto;
        duplicate: boolean;
      }>(`/api/conversations/${encodeURIComponent(id as string)}/messages`, jsonInit("POST", variables)),
    onSuccess: invalidate,
  });
}

export function useAssignConversation(id: string | null) {
  const invalidate = useInvalidateConversation(id);
  return useMutation({
    mutationFn: (variables: { assigneeId: string | null }) =>
      requestJson<{ conversation: InboxConversationDto; event: AuditEventDto }>(
        `/api/conversations/${encodeURIComponent(id as string)}/assign`,
        jsonInit("POST", variables),
      ),
    onSuccess: invalidate,
  });
}

export function useEscalateConversation(id: string | null) {
  const invalidate = useInvalidateConversation(id);
  return useMutation({
    mutationFn: (variables: { reason: EscalationReason; note: string }) =>
      requestJson<{ conversation: InboxConversationDto; message: ConversationMessageDto; event: AuditEventDto }>(
        `/api/conversations/${encodeURIComponent(id as string)}/escalate`,
        jsonInit("POST", variables),
      ),
    onSuccess: invalidate,
  });
}

export function useMoveToPrivate(id: string | null) {
  const invalidate = useInvalidateConversation(id);
  return useMutation({
    mutationFn: (variables: { reason: string; greeting: string }) =>
      requestJson<{
        origin: InboxConversationDto;
        created: InboxConversationDto;
        event: AuditEventDto;
      }>(
        `/api/conversations/${encodeURIComponent(id as string)}/move-to-private`,
        jsonInit("POST", variables),
      ),
    onSuccess: invalidate,
  });
}

/* -------------------------------------------------------------------------
 * Phase 8 additions: customer context, AI assistance, status and audit hooks
 * ---------------------------------------------------------------------- */

export interface CustomerContextResponse {
  customer: CustomerContextDto;
  history: CustomerHistoryDto;
}

export function useCustomerContext(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id, "customer"],
    enabled: id !== null,
    queryFn: () =>
      requestJson<CustomerContextResponse>(`/api/conversations/${encodeURIComponent(id as string)}/customer`),
  });
}

export interface AiSuggestionResponse {
  suggestion: AiSuggestionDto;
  disposition: "draft_only";
  notice: string;
}

export function useAiSuggestion(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { action: AiAction; input?: string }) =>
      requestJson<AiSuggestionResponse>(
        `/api/conversations/${encodeURIComponent(id as string)}/ai`,
        jsonInit("POST", variables),
      ),
    onSuccess: () => {
      // Generation changes the audit trail, so refresh it - but never the
      // timeline: the assistant must not appear to have posted anything.
      void queryClient.invalidateQueries({ queryKey: ["conversation", id, "audit"] });
    },
  });
}

export interface DraftEditVariables {
  action: "adopted" | "edited" | "cleared";
  source: "ai" | "agent";
  characters: number;
}

export function useRecordDraftEdit(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: DraftEditVariables) =>
      requestJson<{ event: AuditEventDto }>(
        `/api/conversations/${encodeURIComponent(id as string)}/draft-edit`,
        jsonInit("POST", variables),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversation", id, "audit"] });
    },
  });
}

export type ConversationStatusVariables =
  | { status: "resolved"; note: string }
  | { status: "open" | "awaiting_customer"; reason: string };

export function useConversationStatus(id: string | null) {
  const invalidate = useInvalidateConversation(id);
  return useMutation({
    mutationFn: (variables: ConversationStatusVariables) =>
      requestJson<{
        conversation: InboxConversationDto;
        event: AuditEventDto;
        message: ConversationMessageDto;
      }>(`/api/conversations/${encodeURIComponent(id as string)}/status`, jsonInit("PATCH", variables)),
    onSuccess: invalidate,
  });
}

/** Records that an agent opened the conversation. Idempotent server-side. */
export function useRecordOpen(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      requestJson<{ event: AuditEventDto; firstOpen: boolean }>(
        `/api/conversations/${encodeURIComponent(id as string)}/open`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversation", id, "audit"] });
    },
  });
}
