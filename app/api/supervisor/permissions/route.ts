import { NextResponse } from "next/server";

import { ROLE_LABELS } from "@/lib/domain/user";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { supervisorPermissionSummary } from "@/server/supervisor/permissions";

/**
 * GET /api/supervisor/permissions (§25)
 *
 * The capability map for the signed-in role. Server-derived from the same RBAC
 * table the API guards use, so a control that is hidden is hidden for the stated
 * reason rather than by a hard-coded UI rule.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.permissions.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(supervisorPermissionSummary(session.user.role, ROLE_LABELS[session.user.role]));
}
