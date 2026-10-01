import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  MESSAGE_BODY_MAX,
  toConversationMessageDto,
  validateMessageBody,
} from "@/lib/domain/conversation";
import { toInboxConversationDto } from "@/lib/domain/inbox";
import { getSessionFromCookies } from "@/server/auth/session";
import { messageAuthorFromUser, toAttachments } from "@/server/conversations/http";
import { canReplyToConversation } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";
import { can } from "@/server/rbac/permissions";

/**
 * Conversation messages (§8).
 *
 * GET  /api/conversations/:id/messages - the full timeline.
 * POST /api/conversations/:id/messages - send a public reply, private reply or
 *      internal note. AI-generated and system kinds can never be written here,
 *      and internal notes are persisted as internal-only.
 */

const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024),
  url: z.string().max(500).optional(),
});

const bodySchema = z.object({
  kind: z.enum(["public", "private", "internal_note"]),
  body: z.string().max(MESSAGE_BODY_MAX),
  attachments: z.array(attachmentSchema).max(5).default([]),
  replyToId: z.string().min(1).optional(),
});

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

  return NextResponse.json({
    messages: store.listMessages(id).map(toConversationMessageDto),
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canReplyToConversation(session.user.role)) {
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
    return NextResponse.json(
      { error: "invalid_body", message: parsed.error.issues[0]?.message ?? "Invalid message." },
      { status: 400 },
    );
  }

  const body = parsed.data.body.trim();
  const validation = validateMessageBody(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "invalid_message", message: validation.message }, { status: 400 });
  }

  const { id } = await context.params;
  const store = demoConversationStore();
  const result = store.sendMessage(id, {
    kind: parsed.data.kind,
    body,
    attachments: toAttachments(parsed.data.attachments),
    author: messageAuthorFromUser(session.user),
    replyToId: parsed.data.replyToId ?? null,
  });

  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      message: toConversationMessageDto(result.message),
      conversation: toInboxConversationDto(result.conversation),
    },
    { status: 201 },
  );
}
