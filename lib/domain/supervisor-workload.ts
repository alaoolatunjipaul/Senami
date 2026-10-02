import type { InboxAssignee } from "@/lib/domain/inbox";
import type { AgentPresence, SupervisorQueueRow } from "@/lib/domain/supervisor";
import { WORKING_PRESENCE } from "@/lib/domain/supervisor";

/**
 * Agent workload (§26 Agent Monitoring).
 *
 * Workload is derived from live assignments rather than stored separately, so
 * reassigning a conversation immediately moves the load between agents. Presence
 * is the one genuinely external input and is supplied by the caller.
 */

/** Target number of active conversations before an agent reads as stretched. */
export const DEFAULT_AGENT_CAPACITY = 6;

export interface AgentPresenceRecord {
  readonly agentId: string;
  readonly presence: AgentPresence;
}

export interface AgentWorkload {
  readonly agentId: string;
  readonly agentName: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly presence: AgentPresence;
  /** Conversations an agent is expected to hold concurrently. */
  readonly capacity: number;
  /** Active conversations currently assigned to this agent. */
  readonly activeConversations: number;
  readonly atRisk: number;
  readonly breached: number;
  readonly escalated: number;
  readonly needsReview: number;
  /** Active load divided by capacity, clamped to 1 so it stays a progress bar. */
  readonly utilisation: number;
  readonly utilisationPercent: number;
  readonly isOverCapacity: boolean;
  readonly hasCapacity: boolean;
  /** Minutes since the last activity on the agent's oldest active conversation. */
  readonly longestIdleMinutes: number;
  readonly href: string;
}

function toWorkload(input: {
  assignee: InboxAssignee;
  presence: AgentPresence;
  capacity: number;
  rows: readonly SupervisorQueueRow[];
}): AgentWorkload {
  const capacity = Math.max(1, input.capacity);
  const activeConversations = input.rows.length;
  // Utilisation is clamped: an agent with eight conversations against a capacity
  // of six is "overloaded", not 133% of a bar.
  const utilisation = Math.min(activeConversations / capacity, 1);
  const longestIdleMinutes = input.rows.reduce(
    (longest, row) => Math.max(longest, row.idleMinutes),
    0,
  );
  const away = !WORKING_PRESENCE.includes(input.presence);

  return {
    agentId: input.assignee.id,
    agentName: input.assignee.name,
    teamId: input.assignee.teamId,
    teamName: input.assignee.teamName,
    presence: input.presence,
    capacity,
    activeConversations,
    atRisk: input.rows.filter((row) => row.sla.state === "warning").length,
    breached: input.rows.filter((row) => row.sla.state === "breached").length,
    escalated: input.rows.filter((row) => row.escalated).length,
    needsReview: input.rows.filter((row) => row.needsReview).length,
    utilisation,
    utilisationPercent: Math.round(utilisation * 100),
    isOverCapacity: activeConversations > capacity,
    // An agent who is offline or away cannot absorb a reassignment, so the
    // assign dialog needs to know this before offering them.
    hasCapacity: !away && activeConversations < capacity,
    longestIdleMinutes,
    href: `/supervisor/queue?assignee=${encodeURIComponent(input.assignee.id)}`,
  };
}

/**
 * Build one workload entry per assignee, including agents holding nothing.
 *
 * An agent with zero conversations still appears: "nobody is holding the
 * Instagram thread" is exactly the signal the monitoring page exists to surface.
 */
export function agentWorkloads(
  assignees: readonly InboxAssignee[],
  rows: readonly SupervisorQueueRow[],
  presence: readonly AgentPresenceRecord[] = [],
  capacity = DEFAULT_AGENT_CAPACITY,
): readonly AgentWorkload[] {
  const presenceByAgent = new Map(presence.map((entry) => [entry.agentId, entry.presence]));

  return assignees.map((assignee) =>
    toWorkload({
      assignee,
      presence: presenceByAgent.get(assignee.id) ?? "offline",
      capacity,
      // Closed conversations still sit on an agent's record but no longer
      // represent live load.
      rows: rows.filter(
        (row) => row.assigneeId === assignee.id && row.status !== "resolved" && row.status !== "closed",
      ),
    }),
  );
}

export const WORKLOAD_SORTS = ["load", "name", "risk"] as const;
export type WorkloadSort = (typeof WORKLOAD_SORTS)[number];

export const WORKLOAD_SORT_LABELS: Record<WorkloadSort, string> = {
  load: "Highest load first",
  name: "Name A-Z",
  risk: "Most SLA risk first",
};

/** Deterministic ordering: overloaded agents surface before idle ones. */
export function compareWorkloads(a: AgentWorkload, b: AgentWorkload, sort: WorkloadSort): number {
  switch (sort) {
    case "name":
      return a.agentName.localeCompare(b.agentName) || a.agentId.localeCompare(b.agentId);
    case "risk": {
      const byBreached = b.breached - a.breached;
      if (byBreached !== 0) return byBreached;
      const byAtRisk = b.atRisk - a.atRisk;
      if (byAtRisk !== 0) return byAtRisk;
      return compareWorkloads(a, b, "load");
    }
    case "load": {
      const byOver = Number(b.isOverCapacity) - Number(a.isOverCapacity);
      if (byOver !== 0) return byOver;
      const byUtilisation = b.utilisation - a.utilisation;
      if (byUtilisation !== 0) return byUtilisation;
      return a.agentName.localeCompare(b.agentName) || a.agentId.localeCompare(b.agentId);
    }
  }
}

export function selectWorkloads(
  workloads: readonly AgentWorkload[],
  sort: WorkloadSort,
): readonly AgentWorkload[] {
  return [...workloads].sort((a, b) => compareWorkloads(a, b, sort));
}

/** Only agents who are on shift and below capacity, best first. */
export function assignableWorkloads(workloads: readonly AgentWorkload[]): readonly AgentWorkload[] {
  return selectWorkloads(workloads, "load").filter((workload) => workload.hasCapacity);
}
