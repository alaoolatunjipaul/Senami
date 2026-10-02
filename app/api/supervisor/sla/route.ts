import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * GET /api/supervisor/sla (§26 SLA Monitoring)
 *
 * Live SLA risk across the team. Every state and deadline is computed server-side
 * by `lib/domain/sla.ts` and returned ready to render: the browser never
 * recomputes a countdown, so an operator's screen cannot disagree with the stored
 * record.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.sla.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(demoSupervisorStore().sla());
}
