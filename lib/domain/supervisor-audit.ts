import { AUDIT_EVENT_META, type AuditEvent, type AuditEventType } from "@/lib/domain/conversation";
import { DATE_PRESET_LABELS, DATE_PRESETS, withinDatePreset, type DatePreset } from "@/lib/domain/inbox";
import type { SupervisorQueueRow } from "@/lib/domain/supervisor";
import { AUDIT_EVENT_TYPES } from "@/lib/domain/conversation";
import type { ConversationStatus, Priority } from "@/lib/domain/taxonomy";
import { formatRelativeTime } from "@/lib/format";

/**
 * Team-wide audit trail (§26 Audit Trail).
 *
 * A supervisor needs one chronological record of what the team did, rather than
 * the per-conversation trail the workspace already shows. This module merges the
 * per-conversation events with live conversation context so an entry can be read
 * without opening twelve threads, and applies the same date-preset vocabulary the
 * inbox uses.
 *
 * The audit is read-only by construction: there is no mutation entry point here.
 */

/** Event types that represent a supervisor or agent action rather than traffic. */
export const SUPERVISOR_OPERATIONAL_EVENT_TYPES = [
  "assigned",
  "reassigned",
  "unassigned",
  "escalated",
  "status_changed",
  "priority_changed",
  "resolved",
  "sla_paused",
  "moved_to_private",
  "opened",
  "draft_edited",
  "ai_suggested",
] as const;

export type SupervisorOperationalEventType = (typeof SUPERVISOR_OPERATIONAL_EVENT_TYPES)[number];

export const AUDIT_TYPE_FILTER_OPTIONS: ReadonlyArray<{ value: AuditEventType; label: string }> =
  AUDIT_EVENT_TYPES.map((type) => ({ value: type, label: AUDIT_EVENT_META[type].label }));

export const AUDIT_TYPE_LABEL: Record<AuditEventType, string> = Object.fromEntries(
  AUDIT_EVENT_TYPES.map((type) => [type, AUDIT_EVENT_META[type].label]),
) as Record<AuditEventType, string>;

export const AUDIT_DATE_OPTIONS = DATE_PRESETS.map((preset) => ({
  value: preset,
  label: DATE_PRESET_LABELS[preset],
}));

export interface SupervisorAuditQuery {
  /** Empty means "every event type". */
  readonly types: readonly AuditEventType[];
  readonly actor: string;
  readonly search: string;
  readonly date: DatePreset;
  readonly page: number;
  readonly pageSize: number;
}

export const AUDIT_DEFAULT_PAGE_SIZE = 30;

export const DEFAULT_SUPERVISOR_AUDIT_QUERY: SupervisorAuditQuery = {
  types: [],
  actor: "",
  search: "",
  date: "any",
  page: 1,
  pageSize: AUDIT_DEFAULT_PAGE_SIZE,
};

export function supervisorAuditQueryFromSearchParams(params: URLSearchParams): SupervisorAuditQuery {
  const date = params.get("date");
  const page = Number(params.get("page"));

  return {
    types: params
      .getAll("type")
      .filter((value): value is AuditEventType => (AUDIT_EVENT_TYPES as readonly string[]).includes(value)),
    actor: params.get("actor") ?? "",
    search: params.get("q") ?? "",
    date: (DATE_PRESETS as readonly string[]).includes(date ?? "") ? (date as DatePreset) : "any",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: AUDIT_DEFAULT_PAGE_SIZE,
  };
}

export function supervisorAuditQueryToSearchParams(query: SupervisorAuditQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const type of query.types) params.append("type", type);
  if (query.actor !== "") params.set("actor", query.actor);
  if (query.search.trim() !== "") params.set("q", query.search.trim());
  if (query.date !== "any") params.set("date", query.date);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function hasActiveAuditFilters(query: SupervisorAuditQuery): boolean {
  return query.types.length > 0 || query.actor !== "" || query.search.trim() !== "" || query.date !== "any";
}

export interface SupervisorAuditRow {
  readonly eventId: string;
  readonly conversationId: string;
  readonly type: AuditEventType;
  readonly typeLabel: string;
  readonly summary: string;
  readonly actor: string;
  readonly createdAt: Date;
  readonly relativeLabel: string;
  readonly customerName: string;
  readonly conversationPreview: string;
  readonly assigneeName: string | null;
  readonly priority: Priority;
  readonly status: ConversationStatus;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>> | undefined;
  readonly href: string;
}

/**
 * Flatten many per-conversation trails into one list.
 *
 * Events whose conversation no longer exists are dropped rather than shown
 * without context: an audit entry an operator cannot trace back to a customer is
 * worse than a missing one.
 */
export function supervisorAuditRows(
  events: readonly AuditEvent[],
  conversations: readonly SupervisorQueueRow[],
  now: Date = new Date(),
): readonly SupervisorAuditRow[] {
  const byId = new Map(conversations.map((row) => [row.id, row]));

  return events
    .flatMap<SupervisorAuditRow>((event) => {
      const row = byId.get(event.conversationId);
      // An event whose conversation no longer exists is dropped rather than shown
      // without context: an audit entry an operator cannot trace back to a
      // customer is worse than a missing one.
      if (!row) return [];

      return [
        {
          eventId: event.id,
          conversationId: event.conversationId,
          type: event.type,
          typeLabel: AUDIT_EVENT_META[event.type].label,
          summary: event.summary,
          actor: event.actor,
          createdAt: event.createdAt,
          relativeLabel: formatRelativeTime(event.createdAt, now),
          customerName: row.customerName,
          conversationPreview: row.preview,
          assigneeName: row.assigneeName,
          priority: row.priority,
          status: row.status,
          metadata: event.metadata,
          href: `/conversations/${event.conversationId}`,
        },
      ];
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.eventId.localeCompare(b.eventId));
}

export function matchesSupervisorAuditQuery(row: SupervisorAuditRow, query: SupervisorAuditQuery, now: Date = new Date()): boolean {
  if (query.types.length > 0 && !query.types.includes(row.type)) return false;
  if (query.actor !== "" && row.actor !== query.actor) return false;
  if (!withinDatePreset(query.date, row.createdAt, now)) return false;

  const term = query.search.trim().toLowerCase();
  if (term === "") return true;

  return [row.summary, row.actor, row.customerName, row.conversationPreview, row.conversationId]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

export function selectSupervisorAuditRows(
  rows: readonly SupervisorAuditRow[],
  query: SupervisorAuditQuery,
  now: Date = new Date(),
): readonly SupervisorAuditRow[] {
  return rows.filter((row) => matchesSupervisorAuditQuery(row, query, now));
}

/** Distinct actors for the filter menu, most active first. */
export function auditActors(rows: readonly SupervisorAuditRow[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.actor, (counts.get(row.actor) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([actor]) => actor);
}

export function auditEventCounts(
  rows: readonly SupervisorAuditRow[],
): ReadonlyArray<{ readonly type: AuditEventType; readonly label: string; readonly count: number }> {
  const counts = new Map<AuditEventType, number>();
  for (const row of rows) counts.set(row.type, (counts.get(row.type) ?? 0) + 1);

  return [...counts.entries()]
    .map(([type, count]) => ({ type, label: AUDIT_EVENT_META[type].label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export interface SupervisorAuditPage {
  readonly items: readonly SupervisorAuditRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

export function toSupervisorAuditPage(
  rows: readonly SupervisorAuditRow[],
  query: SupervisorAuditQuery,
  now: Date = new Date(),
): SupervisorAuditPage {
  const selected = selectSupervisorAuditRows(rows, query, now);
  const pageSize = Math.max(1, query.pageSize);
  const pageCount = Math.max(1, Math.ceil(selected.length / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * pageSize;

  return {
    items: selected.slice(start, start + pageSize),
    total: selected.length,
    page,
    pageSize,
    pageCount,
  };
}

/* -------------------------------------------------------------------------
 * Serialisation (Date -> ISO) across the API boundary
 * ---------------------------------------------------------------------- */

export interface SupervisorAuditRowDto extends Omit<SupervisorAuditRow, "createdAt"> {
  readonly createdAt: string;
}

export function toSupervisorAuditRowDto(row: SupervisorAuditRow): SupervisorAuditRowDto {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export interface SupervisorAuditListResponse {
  readonly page: SupervisorAuditPage;
  readonly actors: readonly string[];
  readonly typeCounts: ReadonlyArray<{ readonly type: AuditEventType; readonly label: string; readonly count: number }>;
}
