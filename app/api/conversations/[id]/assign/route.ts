import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { toInboxConversationDto } from "@/lib/domain/inbox";
import { toAuditEventDto } from "@/lib/domain/conversation";
import { getSessionFromCookies } from "@/server/auth/session";
import { canAssignConversation } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";

/**
 * POST /api/conversations/:id/assign
 *
 * Assign, reassign or unassign a conversation. The policy is enforced here (§29):
 * every agent may claim unassigned work, but taking over another agent's
 * conversation requires supervision.
 */
const bodySchema = z.object({
  assigneeId: z.string().min(1).nullable(),
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
  const conversation = store.getConversation(id);
  const thread = store.threadInfo(id);
  if (!conversation || !thread) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { assigneeId } = parsed.data;
  if (assigneeId !== null && !thread.assignees.some((assignee) => assignee.id === assigneeId)) {
    return NextResponse.json({ error: "invalid_assignee" }, { status: 400 });
  }

  const decision = canAssignConversation(session.user.role, {
    currentAssigneeId: conversation.assignedTo?.id ?? null,
    actorId: session.user.id,
  });
  if (!decision.allowed) {
    return NextResponse.json({ error: "forbidden", message: decision.reason }, { status: 403 });
  }

  const result = store.assign(id, {
    assigneeId,
    actor: session.user.name,
  });
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    conversation: toInboxConversationDto(result.conversation),
    event: toAuditEventDto(result.event),
  });
}
