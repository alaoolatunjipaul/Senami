import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { toAuditEventDto } from "@/lib/domain/conversation";
import { getSessionFromCookies } from "@/server/auth/session";
import { demoConversationStore } from "@/server/conversations/store";
import { can } from "@/server/rbac/permissions";

/**
 * GET /api/conversations/:id/audit
 *
 * The append-only audit trail for a conversation: assignment changes,
 * escalations, public-to-private moves and internal notes.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "conversation.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const store = demoConversationStore();
  if (!store.getConversation(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ events: store.listAudit(id).map(toAuditEventDto) });
}
