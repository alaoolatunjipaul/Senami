import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { selectWorkloads, WORKLOAD_SORTS } from "@/lib/domain/supervisor-workload";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * GET /api/supervisor/team (§26 Agent Monitoring)
 *
 * Presence and workload for every agent. Read-only: capacity and presence are
 * roster facts, and changing who is on shift is a user-management concern, not a
 * supervisor one.
 */

const querySchema = z.object({
  sort: z.enum(WORKLOAD_SORTS).default("load"),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.team.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse({ sort: request.nextUrl.searchParams.get("sort") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const team = demoSupervisorStore().team();

  // Ordering is delegated to the shared comparator so the table here and the
  // "best first" list the assign dialog uses can never drift apart.
  return NextResponse.json({ ...team, workloads: selectWorkloads(team.workloads, parsed.data.sort) });
}
