import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { toAuditEventDto } from "@/lib/domain/conversation";
import { getSessionFromCookies } from "@/server/auth/session";
import { canViewConversation } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";

/**
 * POST /api/conversations/:id/open
 *
 * Records that an agent opened the conversation so the audit trail shows who
 * looked at what. Opening is idempotent per agent: refreshing the workspace
 * does not fill the audit log with duplicates.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canViewConversation(session.user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const result = demoConversationStore().recordOpen(id, { actor: session.user.name });
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    event: toAuditEventDto(result.event),
    firstOpen: result.firstOpen,
  });
}