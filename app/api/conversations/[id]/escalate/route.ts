import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  ESCALATION_NOTE_MAX,
  ESCALATION_REASONS,
  toConversationMessageDto,
  toAuditEventDto,
} from "@/lib/domain/conversation";
import { toInboxConversationDto } from "@/lib/domain/inbox";
import { getSessionFromCookies } from "@/server/auth/session";
import { messageAuthorFromUser } from "@/server/conversations/http";
import { canEscalateConversation } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";

/**
 * POST /api/conversations/:id/escalate
 *
 * Escalate a conversation to a supervisor. An optional internal note is recorded
 * so the reason for the escalation is never lost.
 */
const bodySchema = z.object({
  reason: z.enum(ESCALATION_REASONS),
  note: z.string().max(ESCALATION_NOTE_MAX).default(""),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canEscalateConversation(session.user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
  const result = store.escalate(id, {
    reason: parsed.data.reason,
    note: parsed.data.note,
    author: messageAuthorFromUser(session.user),
    actor: session.user.name,
  });
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    conversation: toInboxConversationDto(result.conversation),
    message: toConversationMessageDto(result.message),
    event: toAuditEventDto(result.event),
  });
}
