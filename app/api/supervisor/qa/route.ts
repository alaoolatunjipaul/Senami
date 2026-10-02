import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { QA_CHECKS, QA_FILTERS } from "@/lib/domain/qa-review";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * GET /api/supervisor/qa (§26 QA Review)
 *
 * The supervisor's quality review queue. Distinct from the `/qa` workspace: that
 * page is the QA team's own scored workspace, this is the supervisor's view of
 * what is waiting for a quality check.
 */

const querySchema = z.object({
  filter: z.enum(QA_FILTERS).default("pending"),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "qa.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse({
    filter: request.nextUrl.searchParams.get("filter") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const board = demoSupervisorStore().qaBoard(parsed.data.filter);
  return NextResponse.json({
    filter: parsed.data.filter,
    items: board.items,
    summary: board.summary,
    // The checklist travels with the data so the dialog can never offer different
    // criteria than the API will accept.
    checks: QA_CHECKS,
  });
}
