import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  RESOLVE_NOTE_MAX,
  RESOLVABLE_STATUSES,
  toAuditEventDto,
  toConversationMessageDto,
} from "@/lib/domain/conversation";
import type { ResolvableStatus } from "@/lib/domain/conversation";
import { toInboxConversationDto } from "@/lib/domain/inbox";
import { getSessionFromCookies } from "@/server/auth/session";
import { canResolveConversation } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";

/**
 * PATCH /api/conversations/:id/status
 *
 * Resolve or reopen a conversation. Resolution is the irreversible direction, so
 * it is a distinct permission and a distinct audit event; reopening is recorded
 * as a status change that puts the thread back in the queue (§8, §42).
 */

/** Everything resolvable except "resolved" itself: the reopen targets. */
type ReopenStatus = Exclude<ResolvableStatus, "resolved">;

const REOPEN_STATUSES = RESOLVABLE_STATUSES.filter(
  (status): status is ReopenStatus => status !== "resolved",
) as unknown as readonly [ReopenStatus, ...ReopenStatus[]];

const bodySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("resolved"),
    note: z.string().max(RESOLVE_NOTE_MAX).default(""),
  }),
  z.object({
    status: z.enum(REOPEN_STATUSES),
    reason: z.string().max(RESOLVE_NOTE_MAX).default(""),
  }),
]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canResolveConversation(session.user.role)) {
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
  const conversation = store.getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (parsed.data.status === "resolved") {
    const result = store.resolve(id, { note: parsed.data.note, actor: session.user.name });
    if (!result) {
      return NextResponse.json({ error: "already_resolved" }, { status: 409 });
    }
    return NextResponse.json({
      conversation: toInboxConversationDto(result.conversation),
      event: toAuditEventDto(result.event),
      message: toConversationMessageDto(result.systemMessage),
    });
  }

  const result = store.setStatus(id, {
    status: parsed.data.status,
    reason: parsed.data.reason,
    actor: session.user.name,
  });
  if (!result) {
    return NextResponse.json({ error: "unchanged" }, { status: 409 });
  }

  return NextResponse.json({
    conversation: toInboxConversationDto(result.conversation),
    event: toAuditEventDto(result.event),
    message: toConversationMessageDto(result.systemMessage),
  });
}