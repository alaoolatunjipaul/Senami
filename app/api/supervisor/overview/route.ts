import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * GET /api/supervisor/overview (§26)
 *
 * Everything the supervisor dashboard renders, in one response. The page issues a
 * single request because the tiles, worklists and charts are all views of the same
 * moment: fetching them separately would let a reassignment land between requests
 * and show a tile that contradicts the list beneath it.
 *
 * Gated on `supervisor.queue.view` because the dashboard is a queue overview; the
 * sections it embeds are additionally filtered by what the role can see.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.queue.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(demoSupervisorStore().dashboard());
}
