import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { agentDashboardDtoFor } from "@/server/agent/store";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";

/**
 * GET /api/agent/dashboard (§10)
 *
 * The agent workspace landing view: queue tiles, response metrics, today's
 * activity and the seeded trend. Gated by `inbox.view` and scoped on the server -
 * an agent only ever sees their own work, never a colleague's.
 */
export async function GET(_request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "inbox.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(agentDashboardDtoFor(session.user));
}