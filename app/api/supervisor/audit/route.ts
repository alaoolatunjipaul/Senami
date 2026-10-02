import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { AUDIT_EVENT_TYPES } from "@/lib/domain/conversation";
import { DATE_PRESETS } from "@/lib/domain/inbox";
import { AUDIT_DEFAULT_PAGE_SIZE, supervisorAuditQueryFromSearchParams } from "@/lib/domain/supervisor-audit";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * GET /api/supervisor/audit (§26 Audit Trail)
 *
 * The team-wide chronological audit trail, merged from every conversation's own
 * trail. Read-only by design: there is no write endpoint, because audit entries are
 * produced by the operations that caused them rather than written on request.
 */

const querySchema = z.object({
  type: z.array(z.enum(AUDIT_EVENT_TYPES)).default([]),
  actor: z.string().min(1).optional(),
  q: z.string().optional(),
  date: z.enum(DATE_PRESETS).default("any"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(AUDIT_DEFAULT_PAGE_SIZE),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.audit.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    type: params.getAll("type"),
    actor: params.get("actor") ?? undefined,
    q: params.get("q") ?? undefined,
    date: params.get("date") ?? undefined,
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
  // The URL parser owns the vocabulary; the schema above is the gate that rejects
  // junk before it reaches the domain defaults.
  const query = supervisorAuditQueryFromSearchParams(params);
  const board = store.auditBoard(
    { ...query, types: parsed.data.type, actor: parsed.data.actor ?? "", page: parsed.data.page, pageSize: parsed.data.pageSize },
  );

  return NextResponse.json({ page: board.page, items: board.items, actors: board.actors, typeCounts: board.typeCounts });
}
