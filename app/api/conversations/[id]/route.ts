import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { toInboxConversationDto } from "@/lib/domain/inbox";
import { getSessionFromCookies } from "@/server/auth/session";
import { demoInboxStore } from "@/server/inbox/store";
import { can } from "@/server/rbac/permissions";

/**
 * GET /api/conversations/:id
 *
 * Returns one conversation summary. Used by the inbox detail pane so a deep
 * link (`/inbox?conversation=...`, e.g. from global search) resolves even when
 * the conversation is not on the current list page.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "conversation.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const conversation = demoInboxStore().getById(id);
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ conversation: toInboxConversationDto(conversation) });
}