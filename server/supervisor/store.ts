import type { AuditEvent, AuditEventDto } from "@/lib/domain/conversation";
import { toAuditEventDto } from "@/lib/domain/conversation";
import {
  escalationRows,
  escalationSummary,
  matchesEscalationFilter,
  type EscalationDetail,
  type EscalationFilter,
  type EscalationRow,
  type EscalationSummary,
} from "@/lib/domain/escalation";
import { DEFAULT_INBOX_QUERY, type InboxConversation, type InboxAssignee, type InboxFilterOptions } from "@/lib/domain/inbox";
import {
  agentPerformances,
  PERFORMANCE_SOURCE_NOTE,
  teamPerformance,
  type PerformanceWindow,
  type TeamPerformance,
  type AgentPerformance,
} from "@/lib/domain/performance";
import {
  qaReviewRows,
  qaSummary,
  toQaReviewRowDto,
  validateQaDecision,
  type QaCheckResults,
  type QaDecision,
  type QaFilter,
  type QaReviewRow,
  type QaReviewRowDto,
  type QaReviewStatus,
  type QaSummary,
} from "@/lib/domain/qa-review";
import {
  slaStateCounts,
  supervisorKpis,
  supervisorSnapshot,
  type SupervisorKpi,
  type SupervisorKpiSnapshot,
} from "@/lib/domain/supervisor-kpi";
import {
  DEFAULT_SUPERVISOR_QUEUE_QUERY,
  selectSupervisorRows,
  supervisorQueueRows,
  toSupervisorQueuePage,
  toSupervisorQueueRowDto,
  type SupervisorQueuePage,
  type SupervisorQueueQuery,
  type SupervisorQueueRow,
  type SupervisorQueueRowDto,
  type SupervisorRosterEntry,
  type SupervisorSlaResponse,
  type SupervisorTeamResponse,
} from "@/lib/domain/supervisor";
import {
  agentWorkloads,
  assignableWorkloads,
  DEFAULT_AGENT_CAPACITY,
  type AgentWorkload,
} from "@/lib/domain/supervisor-workload";
import {
  auditActors,
  auditEventCounts,
  supervisorAuditRows,
  toSupervisorAuditRowDto,
  toSupervisorAuditPage,
  type SupervisorAuditPage,
  type SupervisorAuditQuery,
} from "@/lib/domain/supervisor-audit";
import {
  demoConversationStore,
  type AssignInput,
  type AssignResult,
  type ClearEscalationInput,
  type PriorityChangeInput,
  type PriorityChangeResult,
  type SupervisorActionResult,
} from "@/server/conversations/store";
import { demoInboxStore } from "@/server/inbox/store";
import { buildSupervisorRoster, type SupervisorRoster } from "@/server/supervisor/roster";
import {
  buildSupervisorLedgers,
  mergeEscalationLedger,
  mergeQaLedger,
  seedEscalationLedger,
  seedQaLedger,
  type SupervisorLedgers,
} from "@/server/supervisor/ledgers";

/**
 * Supervisor console aggregation (§26).
 *
 * This module owns no operational state of its own. Every read is recomputed from
 * `demoInboxStore()` and `demoConversationStore()` at the moment of the request,
 * which is what guarantees the console can never disagree with the inbox: the
 * supervisor assigns a conversation, and the queue, every KPI, the workload chart
 * and the SLA page all reflect it in the same response (§38).
 *
 * The only genuinely new state is contextual - why something was escalated, what a
 * reviewer answered - and that lives in the ledgers.
 */

/** Page size used when reading the whole dataset; the supervisor reads it all. */
const READ_ALL_PAGE_SIZE = 1000;

export interface EscalationResolution {
  readonly conversation: SupervisorQueueRow;
  readonly detail: EscalationDetail;
  readonly event: AuditEventDto;
}

export interface QaDecisionResult {
  readonly row: QaReviewRowDto;
  readonly decision: QaDecision;
  readonly event: AuditEventDto;
}

export interface QaValidationFailure {
  readonly errors: Readonly<Record<string, string>>;
}

export interface SupervisorDashboard {
  readonly kpis: readonly SupervisorKpi[];
  readonly snapshot: SupervisorKpiSnapshot;
  readonly roster: readonly SupervisorRosterEntry[];
  readonly rosterSummary: ReturnType<SupervisorRoster["summary"]>;
  readonly escalations: EscalationSummary;
  readonly qa: QaSummary;
  /** Rows needing supervisor attention, most urgent first, for the worklists. */
  readonly needsAttention: readonly SupervisorQueueRowDto[];
  readonly unassigned: readonly SupervisorQueueRowDto[];
  readonly breaches: readonly SupervisorQueueRowDto[];
}

export interface SupervisorPerformance {
  readonly team: TeamPerformance;
  readonly agents: readonly AgentPerformance[];
  readonly note: string;
}

export interface SupervisorStore {
  rows(now?: Date): readonly SupervisorQueueRow[];
  assignees(): readonly InboxAssignee[];
  roster(): readonly SupervisorRosterEntry[];
  options(): InboxFilterOptions;
  kpis(now?: Date): readonly SupervisorKpi[];
  snapshot(now?: Date): SupervisorKpiSnapshot;
  dashboard(now?: Date): SupervisorDashboard;
  queuePage(query: SupervisorQueueQuery, now?: Date): SupervisorQueuePage;
  workloads(now?: Date): readonly AgentWorkload[];
  assignable(now?: Date): readonly AgentWorkload[];
  team(now?: Date): SupervisorTeamResponse;
  sla(now?: Date): SupervisorSlaResponse;
  escalations(filter?: EscalationFilter, now?: Date): readonly EscalationRow[];
  escalationBoard(filter?: EscalationFilter, now?: Date): {
    readonly rows: readonly EscalationRow[];
    readonly summary: EscalationSummary;
  };
  qaReviews(filter?: QaFilter, now?: Date): readonly QaReviewRow[];
  qaBoard(filter?: QaFilter, now?: Date): {
    readonly rows: readonly QaReviewRow[];
    readonly summary: QaSummary;
    readonly items: readonly QaReviewRowDto[];
  };
  auditEvents(): readonly AuditEvent[];
  auditBoard(query: SupervisorAuditQuery, now?: Date): {
    readonly page: SupervisorAuditPage;
    readonly items: readonly ReturnType<typeof toSupervisorAuditRowDto>[];
    readonly actors: readonly string[];
    readonly typeCounts: ReturnType<typeof auditEventCounts>;
  };
  performance(window: PerformanceWindow, now?: Date): SupervisorPerformance;
  assign(id: string, input: AssignInput, now?: Date): AssignResult | null;
  changePriority(id: string, input: PriorityChangeInput, now?: Date): PriorityChangeResult | null;
  resolveEscalation(
    id: string,
    input: Omit<ClearEscalationInput, "actor"> & { readonly actorId: string; readonly actorName: string },
    now?: Date,
  ): EscalationResolution | null;
  decideQa(
    id: string,
    input: { checks: QaCheckResults; status: QaReviewStatus; note: string; actorId: string; actorName: string },
    now?: Date,
  ): QaDecisionResult | QaValidationFailure | null;
  reset(): void;
}

export function buildSupervisorStore(): SupervisorStore {
  let ledgers: SupervisorLedgers = buildSupervisorLedgers();
  let roster: SupervisorRoster = buildSupervisorRoster(demoInboxStore().assignees());

  function allConversations(): readonly InboxConversation[] {
    return demoInboxStore().list({ ...DEFAULT_INBOX_QUERY, page: 1, pageSize: READ_ALL_PAGE_SIZE }).items;
  }

  function rows(now: Date = new Date()): readonly SupervisorQueueRow[] {
    return supervisorQueueRows(allConversations(), now);
  }

  function auditFor(conversationId: string): readonly AuditEvent[] {
    return demoConversationStore().listAudit(conversationId);
  }

  function escalationLedger(): readonly EscalationDetail[] {
    return mergeEscalationLedger(seedEscalationLedger(allConversations(), auditFor), ledgers.escalationOutcomes);
  }

  function qaLedger() {
    const seeds = seedQaLedger(allConversations(), auditFor);
    return { ledger: mergeQaLedger(seeds, ledgers.qaDrafts, ledgers.qaDecisions), decisions: ledgers.qaDecisions };
  }

  function escalateNow(now: Date): readonly EscalationRow[] {
    return escalationRows(rows(now), escalationLedger(), now);
  }

  function rosterList(): readonly SupervisorRosterEntry[] {
    return roster.list();
  }

  function kpis(now: Date = new Date()): readonly SupervisorKpi[] {
    return supervisorKpis(rows(now), rosterList());
  }

  function snapshot(now: Date = new Date()): SupervisorKpiSnapshot {
    return supervisorSnapshot(rows(now), rosterList());
  }

  function queuePage(query: SupervisorQueueQuery, now: Date = new Date()): SupervisorQueuePage {
    return toSupervisorQueuePage(rows(now), query);
  }

  function workloads(now: Date = new Date()): readonly AgentWorkload[] {
    return agentWorkloads(demoInboxStore().assignees(), rows(now), rosterList(), DEFAULT_AGENT_CAPACITY);
  }

  function escalationBoard(
    filter: EscalationFilter = "open",
    now: Date = new Date(),
  ): { readonly rows: readonly EscalationRow[]; readonly summary: EscalationSummary } {
    const all = escalationRows(rows(now), escalationLedger(), now);
    return {
      rows: all.filter((row) => matchesEscalationFilter(row, filter)),
      summary: escalationSummary(all),
    };
  }

  function qaBoard(
    filter: QaFilter = "pending",
    now: Date = new Date(),
  ): {
    readonly rows: readonly QaReviewRow[];
    readonly summary: QaSummary;
    readonly items: readonly QaReviewRowDto[];
  } {
    const { ledger, decisions } = qaLedger();
    const all = qaReviewRows(rows(now), ledger, [...decisions.values()]);
    const filtered = all.filter((row) => filter === "all" || row.status === filter);
    return {
      rows: filtered,
      summary: qaSummary(all),
      items: filtered.map(toQaReviewRowDto),
    };
  }

  function performance(window: PerformanceWindow, now: Date = new Date()): SupervisorPerformance {
    const agents = agentPerformances(demoInboxStore().assignees(), rows(now), window, now);
    return { team: teamPerformance(agents, window), agents, note: PERFORMANCE_SOURCE_NOTE };
  }

  function auditBoard(query: SupervisorAuditQuery, now: Date = new Date()) {
    const all = allConversations();
    const events = all.flatMap((conversation) => auditFor(conversation.id));
    const built = supervisorAuditRows(events, rows(now), now);
    const page = toSupervisorAuditPage(built, query, now);
    return {
      page,
      items: page.items.map(toSupervisorAuditRowDto),
      actors: auditActors(built),
      typeCounts: auditEventCounts(built),
    };
  }

  return {
    rows,
    assignees: () => demoInboxStore().assignees(),
    roster: rosterList,
    options: () => demoInboxStore().options(),
    kpis,
    snapshot,
    dashboard(now: Date = new Date()): SupervisorDashboard {
      const all = rows(now);
      const escalation = escalateNow(now);
      const { ledger, decisions } = qaLedger();
      const reviewRows = qaReviewRows(all, ledger, [...decisions.values()]);
      const active = selectSupervisorRows(all, {
        status: "active",
        assignment: "all",
        priority: "",
        sla: "",
        channels: [],
        assigneeId: "",
        teamId: "",
        escalation: "all",
        search: "",
        sort: "urgency",
        page: 1,
        pageSize: 25,
      });

      return {
        kpis: supervisorKpis(all, rosterList()),
        snapshot: supervisorSnapshot(all, rosterList()),
        roster: rosterList(),
        rosterSummary: roster.summary(),
        escalations: escalationSummary(escalation),
        qa: qaSummary(reviewRows),
        needsAttention: active.slice(0, 8).map(toSupervisorQueueRowDto),
        unassigned: all
          .filter((row) => row.assigneeId === null && row.status !== "resolved" && row.status !== "closed")
          .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
          .slice(0, 8)
          .map(toSupervisorQueueRowDto),
        breaches: all
          .filter((row) => row.sla.state === "breached")
          .sort((a, b) => a.sla.remainingMs - b.sla.remainingMs)
          .slice(0, 8)
          .map(toSupervisorQueueRowDto),
      };
    },
    queuePage,
    workloads,
    assignable: (now: Date = new Date()) => assignableWorkloads(workloads(now)),
    team(now: Date = new Date()): SupervisorTeamResponse {
      const list = workloads(now);
      return {
        workloads: list,
        roster: rosterList(),
        summary: roster.summary(),
        overloaded: list.filter((workload) => workload.isOverCapacity).length,
        withCapacity: list.filter((workload) => workload.hasCapacity).length,
      };
    },
    sla(now: Date = new Date()): SupervisorSlaResponse {
      const all = rows(now);
      const counts = slaStateCounts(all);
      const answered = all.filter((row) => row.firstResponseMinutes !== null);
      const met = answered.filter((row) => row.sla.state === "met").length;
      const compliance = answered.length === 0 ? null : met / answered.length;
      const active = all.filter((row) => row.status !== "resolved" && row.status !== "closed");
      const breached = active.filter((row) => row.sla.state === "breached");

      return {
        // The SLA page is a worklist of live risk, not a closed history, so it is
        // ordered by remaining time and never paginated away.
        rows: selectSupervisorRows(
          active.filter((row) => row.sla.state !== "met"),
          { ...DEFAULT_SUPERVISOR_QUEUE_QUERY, sort: "sla_remaining", pageSize: READ_ALL_PAGE_SIZE },
        ).map(toSupervisorQueueRowDto),
        counts,
        compliance,
        complianceLabel: compliance === null ? "\u2014" : `${Math.round(compliance * 100)}%`,
        breachRate: active.length === 0 ? null: breached.length / active.length,
        breachRateLabel:
          active.length === 0 ? "\u2014" : `${Math.round((breached.length / active.length) * 100)}%`,
        note: PERFORMANCE_SOURCE_NOTE,
      };
    },
    escalations: (filter: EscalationFilter = "open", now: Date = new Date()) => escalationBoard(filter, now).rows,
    escalationBoard,
    qaReviews: (filter: QaFilter = "pending", now: Date = new Date()) => qaBoard(filter, now).rows,
    qaBoard,
    auditEvents: () => allConversations().flatMap((conversation) => auditFor(conversation.id)),
    auditBoard,
    performance,
    assign: (id, input, now) => demoConversationStore().assign(id, input, now),
    changePriority: (id, input, now) => demoConversationStore().changePriority(id, input, now),
    resolveEscalation(id, input, now: Date = new Date()): EscalationResolution | null {
      const result: SupervisorActionResult | null = demoConversationStore().clearEscalation(
        id,
        { outcome: input.outcome, note: input.note, actor: input.actorName },
        now,
      );
      if (!result) return null;

      const existing = escalationLedger().find((entry) => entry.conversationId === id);
      const detail: EscalationDetail = {
        ...(existing ?? {
          conversationId: id,
          reason: "other" as const,
          note: "",
          escalatedById: "",
          escalatedByName: "Unknown",
          escalatedAt: now,
        }),
        outcome: input.outcome,
        resolvedAt: now,
        resolvedById: input.actorId,
        resolvedByName: input.actorName,
        resolutionNote: input.note.trim(),
      };
      ledgers.escalationOutcomes.set(id, detail);

      const row = rows(now).find((candidate) => candidate.id === id);
      if (!row) return null;
      return { conversation: row, detail, event: toAuditEventDto(result.event) };
    },
    decideQa(
      id,
      input,
      now: Date = new Date(),
    ): QaDecisionResult | QaValidationFailure | null {
      const validation = validateQaDecision(input.checks, input.status, input.note);
      if (!validation.valid) return { errors: validation.errors };

      if (input.status !== "approved" && input.status !== "changes_requested") {
        // A status such as "in_review" carries no decision, so it only marks the
        // item as being worked on.
        const { ledger, decisions } = qaLedger();
        const existing = ledger.find((entry) => entry.conversationId === id);
        const merged = mergeQaLedger(
          ledger,
          new Map(ledgers.qaDrafts).set(id, {
            conversationId: id,
            trigger: existing?.trigger ?? "sensitive_reply",
            messageId: existing?.messageId ?? null,
            submittedAt: existing?.submittedAt ?? now,
            submittedById: existing?.submittedById ?? "",
            submittedByName: existing?.submittedByName ?? "Unknown",
            status: input.status,
            checks: { ...existing?.checks, ...input.checks },
            note: input.note,
            reviewerId: input.actorId,
            reviewerName: input.actorName,
            decidedAt: existing?.decidedAt ?? null,
          }),
          decisions,
        );
        const updated = merged.find((entry) => entry.conversationId === id);
        if (!updated) return null;
        ledgers.qaDrafts.set(id, updated);
        return null;
      }

      const result = demoConversationStore().clearQaReview(
        id,
        { outcome: input.status, note: input.note, actor: input.actorName },
        now,
      );
      if (!result) return null;

      const decision: QaDecision = {
        conversationId: id,
        status: input.status,
        checks: input.checks,
        note: input.note.trim(),
        reviewerId: input.actorId,
        reviewerName: input.actorName,
        decidedAt: now,
      };
      ledgers.qaDecisions.set(id, decision);
      ledgers.qaDrafts.delete(id);

      const { ledger, decisions } = qaLedger();
      const row = qaReviewRows(rows(now), ledger, [...decisions.values()]).find(
        (candidate) => candidate.conversationId === id,
      );
      if (!row) return null;

      return { row: toQaReviewRowDto(row), decision, event: toAuditEventDto(result.event) };
    },
    reset(): void {
      ledgers = buildSupervisorLedgers();
      roster = buildSupervisorRoster(demoInboxStore().assignees());
    },
  };
}

/* -------------------------------------------------------------------------
 * Process-wide singleton
 * ---------------------------------------------------------------------- */

let activeStore: SupervisorStore = buildSupervisorStore();

export function demoSupervisorStore(): SupervisorStore {
  return activeStore;
}

/**
 * Rebuild the supervisor store, discarding recorded escalation outcomes and QA
 * decisions.
 *
 * Called after the underlying demo stores are reset so a test or a fresh session
 * never sees a decision that belonged to a previous dataset.
 */
export function resetDemoSupervisorStore(): SupervisorStore {
  activeStore = buildSupervisorStore();
  return activeStore;
}
