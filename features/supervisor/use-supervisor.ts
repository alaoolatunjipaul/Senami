"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { AuditEventDto } from "@/lib/domain/conversation";
import type { EscalationDetail, EscalationRow, EscalationSummary } from "@/lib/domain/escalation";
import type { SupervisorKpi, SupervisorKpiSnapshot } from "@/lib/domain/supervisor-kpi";
import type { SupervisorRosterEntry } from "@/lib/domain/supervisor";
import type { AgentPerformance, PerformanceWindow, TeamPerformance } from "@/lib/domain/performance";
import type { QaCheckResults, QaReviewRowDto, QaReviewStatus, QaSummary } from "@/lib/domain/qa-review";
import type { AgentWorkload } from "@/lib/domain/supervisor-workload";
import type { SupervisorAuditRowDto } from "@/lib/domain/supervisor-audit";
import type {
  SupervisorQueueListResponse,
  SupervisorQueueQuery,
  SupervisorSlaResponse,
  SupervisorTeamResponse,
} from "@/lib/domain/supervisor";
import type { SupervisorPermissionSummary } from "@/server/supervisor/permissions";

/**
 * Supervisor console data access (§26).
 *
 * Every mutation invalidates the whole `supervisor` key rather than one endpoint.
 * That is not laziness: the console's figures are all views of the same
 * conversations, so reassigning one conversation changes the queue, the KPI tiles,
 * the agent workload, the SLA page and the audit trail at once. Invalidating
 * narrowly would let two of those disagree on screen.
 */

/** Shape of the dashboard payload, assembled from the domain types. */
export interface SupervisorOverview {
  readonly kpis: readonly SupervisorKpi[];
  readonly snapshot: SupervisorKpiSnapshot;
  readonly roster: readonly SupervisorRosterEntry[];
  readonly rosterSummary: { readonly online: number; readonly busy: number; readonly away: number; readonly offline: number; readonly total: number };
  readonly escalations: EscalationSummary;
  readonly qa: QaSummary;
  readonly needsAttention: SupervisorQueueListResponse["page"]["items"];
  readonly unassigned: SupervisorQueueListResponse["page"]["items"];
  readonly breaches: SupervisorQueueListResponse["page"]["items"];
}

export interface EscalationBoard {
  readonly filter: string;
  readonly rows: readonly EscalationRow[];
  readonly summary: EscalationSummary;
}

export interface QaBoard {
  readonly filter: string;
  readonly items: readonly QaReviewRowDto[];
  readonly summary: QaSummary;
}

export interface PerformanceBoard {
  readonly team: TeamPerformance;
  readonly agents: readonly AgentPerformance[];
  readonly note: string;
}

export interface AuditBoard {
  readonly page: { items: readonly SupervisorAuditRowDto[]; total: number; page: number; pageSize: number; pageCount: number };
  readonly items: readonly SupervisorAuditRowDto[];
  readonly actors: readonly string[];
  readonly typeCounts: ReadonlyArray<{ readonly type: string; readonly label: string; readonly count: number }>;
}

export class SupervisorApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = "SupervisorApiError";
  }
}

/**
 * One fetch helper for the whole console.
 *
 * A 403 is surfaced as a distinct error rather than a generic failure, because a
 * supervisor who lost a permission needs to be told the action is not theirs to
 * take - not that the server is unreachable.
 */
async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let fieldErrors: Record<string, string> = {};
    try {
      const body = (await response.json()) as { error?: string; errors?: Record<string, string> };
      fieldErrors = body.errors ?? {};
    } catch {
      // A non-JSON error body is still worth reporting by status.
    }

    const message =
      response.status === 403
        ? "You do not have permission to do that."
        : response.status === 404
          ? "That item no longer exists."
          : `Request failed (${response.status}).`;

    throw new SupervisorApiError(message, response.status, fieldErrors);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* -------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------- */

export function useSupervisorOverview() {
  return useQuery({
    queryKey: ["supervisor", "overview"],
    queryFn: () => fetchJson<SupervisorOverview>("/api/supervisor/overview"),
  });
}

function queueSearchParams(query: SupervisorQueueQuery): string {
  const params = new URLSearchParams();
  if (query.status !== "") params.set("status", query.status);
  if (query.assignment !== "all") params.set("assignment", query.assignment);
  if (query.priority !== "") params.set("priority", query.priority);
  if (query.sla !== "") params.set("sla", query.sla);
  for (const channel of query.channels) params.append("channel", channel);
  if (query.assigneeId !== "") params.set("assignee", query.assigneeId);
  if (query.teamId !== "") params.set("team", query.teamId);
  if (query.escalation !== "all") params.set("escalation", query.escalation);
  if (query.search.trim() !== "") params.set("q", query.search.trim());
  if (query.sort !== "urgency") params.set("sort", query.sort);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  return params.toString();
}

export function useSupervisorQueue(query: SupervisorQueueQuery) {
  const search = useMemo(() => queueSearchParams(query), [query]);

  return useQuery({
    queryKey: ["supervisor", "queue", search],
    queryFn: () =>
      fetchJson<
        SupervisorQueueListResponse & { readonly kpis: readonly SupervisorKpi[] }
      >(`/api/supervisor/queue?${search}`),
    // Keep the previous page visible while the next one loads, so changing a
    // filter does not flash an empty table.
    placeholderData: keepPreviousData,
  });
}

export function useSupervisorTeam(sort: "load" | "name" | "risk") {
  return useQuery({
    queryKey: ["supervisor", "team", sort],
    queryFn: () =>
      fetchJson<SupervisorTeamResponse & { readonly workloads: readonly AgentWorkload[] }>(
        `/api/supervisor/team?sort=${sort}`,
      ),
  });
}

export function useSupervisorSla() {
  return useQuery({
    queryKey: ["supervisor", "sla"],
    queryFn: () => fetchJson<SupervisorSlaResponse>("/api/supervisor/sla"),
  });
}

export function useSupervisorEscalations(filter: string) {
  return useQuery({
    queryKey: ["supervisor", "escalations", filter],
    queryFn: () => fetchJson<EscalationBoard>(`/api/supervisor/escalations?filter=${filter}`),
  });
}

export function useSupervisorQa(filter: string) {
  return useQuery({
    queryKey: ["supervisor", "qa", filter],
    queryFn: () => fetchJson<QaBoard>(`/api/supervisor/qa?filter=${filter}`),
  });
}

export function useSupervisorPerformance(window: PerformanceWindow) {
  return useQuery({
    queryKey: ["supervisor", "performance", window],
    queryFn: () => fetchJson<PerformanceBoard>(`/api/supervisor/performance?window=${window}`),
  });
}

export function useSupervisorAudit(params: URLSearchParams) {
  const search = params.toString();

  return useQuery({
    queryKey: ["supervisor", "audit", search],
    queryFn: () =>
      fetchJson<AuditBoard>(`/api/supervisor/audit${search ? `?${search}` : ""}`),
    placeholderData: keepPreviousData,
  });
}

export function useSupervisorPermissions() {
  return useQuery({
    queryKey: ["supervisor", "permissions"],
    queryFn: () => fetchJson<SupervisorPermissionSummary>("/api/supervisor/permissions"),
  });
}

/* -------------------------------------------------------------------------
 * Mutations
 * ---------------------------------------------------------------------- */

/**
 * Invalidate every supervisor read after any mutation.
 *
 * Deliberately coarse: a reassignment moves the conversation between agents, so
 * the workload, the queue, the KPI tiles and the audit trail are all now wrong.
 */
function useInvalidateSupervisor() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["supervisor"] });
}

export interface EscalationResolution {
  readonly detail: EscalationDetail;
  readonly event: AuditEventDto;
}

export function useResolveEscalation() {
  const invalidate = useInvalidateSupervisor();

  return useMutation({
    mutationFn: (input: { id: string; outcome: "resolved" | "reassigned" | "dismissed"; note: string }) =>
      postJson<EscalationResolution>(
        `/api/supervisor/escalations/${encodeURIComponent(input.id)}/resolve`,
        { outcome: input.outcome, note: input.note },
      ),
    onSuccess: invalidate,
  });
}

export function useDecideQaReview() {
  const invalidate = useInvalidateSupervisor();

  return useMutation({
    mutationFn: (input: { id: string; checks: QaCheckResults; status: QaReviewStatus; note: string }) =>
      postJson<{ row: QaReviewRowDto; event: AuditEventDto }>(
        `/api/supervisor/qa/${encodeURIComponent(input.id)}`,
        { checks: input.checks, status: input.status, note: input.note },
      ),
    onSuccess: invalidate,
  });
}

/**
 * Reassign or unassign.
 *
 * Reuses the conversation assign endpoint rather than adding a supervisor-specific
 * one, so the assignment rules in `canAssignConversation` and the resulting audit
 * event are identical whichever surface initiated the change.
 */
export function useSupervisorAssign() {
  const invalidate = useInvalidateSupervisor();

  return useMutation({
    mutationFn: (input: { id: string; assigneeId: string | null }) =>
      postJson<{ ok: true }>(`/api/conversations/${encodeURIComponent(input.id)}/assign`, {
        assigneeId: input.assigneeId,
      }),
    onSuccess: invalidate,
  });
}

export function useChangePriority() {
  const invalidate = useInvalidateSupervisor();

  return useMutation({
    mutationFn: (input: { id: string; priority: string; reason: string }) =>
      fetchJson<{ conversation: unknown; event: AuditEventDto }>(
        `/api/conversations/${encodeURIComponent(input.id)}/priority`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: input.priority, reason: input.reason }),
        },
      ),
    onSuccess: invalidate,
  });
}
