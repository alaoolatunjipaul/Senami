import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { PERFORMANCE_WINDOWS } from "@/lib/domain/performance";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * GET /api/supervisor/performance (§26 Team Performance)
 *
 * Team and per-agent performance. The response carries a note describing exactly
 * what the figures are measured from, because a supervisor comparing them against
 * a reporting warehouse must be able to see that they are not the same thing.
 */

const querySchema = z.object({
  window: z.enum(PERFORMANCE_WINDOWS).default("week"),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.performance.view")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse({
    window: request.nextUrl.searchParams.get("window") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  return NextResponse.json(demoSupervisorStore().performance(parsed.data.window));
}
