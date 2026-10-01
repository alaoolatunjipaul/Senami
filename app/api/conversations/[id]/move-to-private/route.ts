import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { MESSAGE_BODY_MAX, toAuditEventDto } from "@/lib/domain/conversation";
import { toInboxConversationDto } from "@/lib/domain/inbox";
import { getSessionFromCookies } from "@/server/auth/session";
import { messageAuthorFromUser } from "@/server/conversations/http";
import { canMoveToPrivate } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";

/**
 * POST /api/conversations/:id/move-to-private
 *
 * The defining workflow of Senami (§3): move a public interaction into a direct
 * message. The original public conversation is preserved; a new private
 * conversation is created and linked, and the move is written to the audit trail.
 * The UI shows `MOVE_TO_PRIVATE_WARNING` before this endpoint is called.
 */
const bodySchema = z.object({
  reason: z.string().min(1).max(300),
  greeting: z.string().max(MESSAGE_BODY_MAX).default(""),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { id } = await context.params;
  const store = demoConversationStore();
  const thread = store.threadInfo(id);
  if (!thread) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (thread.movedToConversationId !== null) {
    return NextResponse.json({ error: "already_moved" }, { status: 409 });
  }
  if (!canMoveToPrivate(session.user.role, thread)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = store.moveToPrivate(id, {
    reason: parsed.data.reason.trim(),
    greeting: parsed.data.greeting.trim(),
    author: messageAuthorFromUser(session.user),
    actor: session.user.name,
  });
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      origin: toInboxConversationDto(result.origin),
      created: toInboxConversationDto(result.created),
      event: toAuditEventDto(result.event),
    },
    { status: 201 },
  );
}
