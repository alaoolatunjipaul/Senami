import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { CHANNELS } from "@/lib/config";
import {
  DATE_PRESETS,
  DEFAULT_PAGE_SIZE,
  INBOX_VIEWS,
  toInboxConversationDto,
  type InboxListResponse,
  type InboxQuery,
} from "@/lib/domain/inbox";
import { INTENTS, PRIORITIES, SENTIMENTS } from "@/lib/domain/taxonomy";
import { getSessionFromCookies } from "@/server/auth/session";
import { demoInboxStore } from "@/server/inbox/store";
import { can } from "@/server/rbac/permissions";

/**
 * GET /api/conversations (§15)
 *
 * Lists conversations for the inbox with the full filter surface: view preset,
 * channel(s), intent, sentiment, priority, SLA state, assignee, team, date
 * preset and free-text search, with pagination. Validated with Zod, gated by
 * the `inbox.view` permission, and backed by the deterministic store.
 */

const SLA_VALUES = ["safe", "warning", "breached", "met", "paused"] as const;

const querySchema = z.object({
  view: z.enum(INBOX_VIEWS).default("all"),
  channel: z.array(z.enum(CHANNELS)).default([]),
  intent: z.enum(INTENTS).optional(),
  sentiment: z.enum(SENTIMENTS).optional(),
  priority: z.enum(PRIORITIES).optional(),
  sla: z.enum(SLA_VALUES).optional(),
  assignee: z.string().min(1).optional(),
  team: z.string().min(1).optional(),
  date: z.enum(DATE_PRESETS).default("any"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "inbox.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    view: params.get("view") ?? undefined,
    channel: params.getAll("channel"),
    intent: params.get("intent") ?? undefined,
    sentiment: params.get("sentiment") ?? undefined,
    priority: params.get("priority") ?? undefined,
    sla: params.get("sla") ?? undefined,
    assignee: params.get("assignee") ?? undefined,
    team: params.get("team") ?? undefined,
    date: params.get("date") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    q: params.get("q") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", message: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400 },
    );
  }

  const query: InboxQuery = {
    view: parsed.data.view,
    channels: parsed.data.channel,
    intent: parsed.data.intent ?? "",
    sentiment: parsed.data.sentiment ?? "",
    priority: parsed.data.priority ?? "",
    sla: parsed.data.sla ?? "",
    assigneeId: parsed.data.assignee ?? "",
    teamId: parsed.data.team ?? "",
    date: parsed.data.date,
    dateFrom: parsed.data.from ?? "",
    dateTo: parsed.data.to ?? "",
    search: parsed.data.q ?? "",
    userId: session.user.id,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  };

  const store = demoInboxStore();
  const result = store.list(query);

  const body: InboxListResponse = {
    items: result.items.map(toInboxConversationDto),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    options: store.options(),
  };

  return NextResponse.json(body);
}