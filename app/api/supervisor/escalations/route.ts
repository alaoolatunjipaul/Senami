import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ESCALATION_OUTCOMES } from "@/lib/domain/escalation";
import { ESCALATION_FILTERS } from "@/lib/domain/escalation";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * GET /api/supervisor/escalations (§26)
 *
 * The escalation board. Filtered by default to open items, because a supervisor
 * opening this page is looking for what still needs a decision, not for history.
 */

const querySchema = z.object({
  filter: z.enum(ESCALATION_FILTERS).default("open"),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.escalations.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse({
    filter: request.nextUrl.searchParams.get("filter") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const board = demoSupervisorStore().escalationBoard(parsed.data.filter);
  return NextResponse.json({
    filter: parsed.data.filter,
    rows: board.rows,
    summary: board.summary,
    outcomes: ESCALATION_OUTCOMES,
  });
}
