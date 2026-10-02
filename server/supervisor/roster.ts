import type { InboxAssignee } from "@/lib/domain/inbox";
import {
  AGENT_PRESENCE_META,
  type AgentPresence,
  type SupervisorRosterEntry,
} from "@/lib/domain/supervisor";
import { DEFAULT_AGENT_CAPACITY } from "@/lib/domain/supervisor-workload";

/**
 * Agent presence roster.
 *
 * Presence is the one supervisor figure Senami cannot derive from conversation
 * records - it describes a human, not a thread. This module is the single place
 * that claim is made, so it is deterministic and seeded per agent id rather than
 * random per request: a supervisor who reloads the page must not see the team
 * reshuffle, and a test must not depend on a random seed.
 *
 * Agent ids come from `demoInboxStore().assignees()`, so an entry can never
 * describe an agent the platform does not have.
 */

/**
 * Fixed rotation keyed by agent id. Offline sits at the end so the default for an
 * unfamiliar id is a working state rather than an invisible one.
 */
const PRESENCE_CYCLE: readonly AgentPresence[] = ["online", "online", "busy", "online", "away", "offline"];

/**
 * Stable 32-bit string hash. Used only to pick an offset into the presence cycle,
 * so a given agent always resolves to the same state.
 */
function hashId(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function presenceForAgent(agentId: string): AgentPresence {
  return PRESENCE_CYCLE[hashId(agentId) % PRESENCE_CYCLE.length] ?? "offline";
}

export interface SupervisorRoster {
  list(): readonly SupervisorRosterEntry[];
  get(agentId: string): SupervisorRosterEntry | null;
  summary(): {
    readonly online: number;
    readonly busy: number;
    readonly away: number;
    readonly offline: number;
    readonly total: number;
  };
}

/**
 * Build a roster over the given assignees.
 *
 * Capacity comes from the shared default rather than being stored per agent: a
 * per-agent capacity field would be a second source of truth that could disagree
 * with the workload calculation, which is derived from this same number.
 */
export function buildSupervisorRoster(assignees: readonly InboxAssignee[]): SupervisorRoster {
  const entries: readonly SupervisorRosterEntry[] = assignees.map((assignee) => {
    const presence = presenceForAgent(assignee.id);
    return {
      agentId: assignee.id,
      agentName: assignee.name,
      teamId: assignee.teamId,
      teamName: assignee.teamName,
      presence,
      presenceLabel: AGENT_PRESENCE_META[presence].label,
      capacity: DEFAULT_AGENT_CAPACITY,
    };
  });

  return {
    list(): readonly SupervisorRosterEntry[] {
      return entries;
    },
    get(agentId: string): SupervisorRosterEntry | null {
      return entries.find((entry) => entry.agentId === agentId) ?? null;
    },
    summary() {
      const count = (presence: AgentPresence): number =>
        entries.filter((entry) => entry.presence === presence).length;

      return {
        online: count("online"),
        busy: count("busy"),
        away: count("away"),
        offline: count("offline"),
        total: entries.length,
      };
    },
  };
}
