import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { CHANNELS } from "@/lib/config";
import { DEFAULT_SUPERVISOR_QUEUE_QUERY } from "@/lib/domain/supervisor";
import { PRIORITIES } from "@/lib/domain/taxonomy";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * GET /api/supervisor/queue (§26)
 *
 * The team-wide queue. Same rows, same SLA evaluation and same filter vocabulary
 * the server used to build the dashboard, so a tile click and a manual filter can
 * never land on different data.
 */

const SLA_VALUES = ["safe", "warning", "breached", "met", "paused"] as const;

const STATUS_VALUES = [
  "open",
  "pending",
  "awaiting_customer",
  "escalated",
  "resolved",
  "closed",
  "active",
  "waiting",
] as const;

const ASSIGNMENT_VALUES = ["all", "assigned", "unassigned"] as const;
const ESCALATION_VALUES = ["all", "escalated", "not_escalated"] as const;
const SORT_VALUES = ["urgency", "newest", "oldest", "sla_remaining"] as const;

const querySchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  assignment: z.enum(ASSIGNMENT_VALUES).default("all"),
  priority: z.enum(PRIORITIES).optional(),
  sla: z.enum(SLA_VALUES).optional(),
  channel: z.array(z.enum(CHANNELS)).default([]),
  assignee: z.string().min(1).optional(),
  team: z.string().min(1).optional(),
  escalation: z.enum(ESCALATION_VALUES).default("all"),
  q: z.string().optional(),
  sort: z.enum(SORT_VALUES).default("urgency"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(DEFAULT_SUPERVISOR_QUEUE_QUERY.pageSize),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.queue.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    status: params.get("status") ?? undefined,
    assignment: params.get("assignment") ?? undefined,
    priority: params.get("priority") ?? undefined,
    sla: params.get("sla") ?? undefined,
    channel: params.getAll("channel"),
    assignee: params.get("assignee") ?? undefined,
    team: params.get("team") ?? undefined,
    escalation: params.get("escalation") ?? undefined,
    q: params.get("q") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", message: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400 },
    );
  }

  const store = demoSupervisorStore();
  const page = store.queuePage(
    {
      status: parsed.data.status ?? "",
      assignment: parsed.data.assignment,
      priority: parsed.data.priority ?? "",
      sla: parsed.data.sla ?? "",
      channels: parsed.data.channel,
      assigneeId: parsed.data.assignee ?? "",
      teamId: parsed.data.team ?? "",
      escalation: parsed.data.escalation,
      search: parsed.data.q ?? "",
      sort: parsed.data.sort,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    },
    new Date(),
  );

  return NextResponse.json({
    page,
    kpis: store.kpis(),
    options: store.options(),
    roster: store.roster(),
  });
}
