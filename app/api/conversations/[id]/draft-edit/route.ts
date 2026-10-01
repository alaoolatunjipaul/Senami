import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { AI_INPUT_MAX } from "@/lib/domain/ai";
import { MESSAGE_BODY_MAX, toAuditEventDto } from "@/lib/domain/conversation";
import { getSessionFromCookies } from "@/server/auth/session";
import { canReplyToConversation, canUseAiAssist } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";

/**
 * POST /api/conversations/:id/draft-edit
 *
 * Records an edit to the draft the agent is working on, so the audit trail shows
 * what was changed and whether the wording came from the AI. The draft itself is
 * never persisted: nothing here sends anything, and an unsent draft stays on the
 * agent's screen, not in the database.
 */
const bodySchema = z.object({
  action: z.enum(["adopted", "edited", "cleared"]),
  source: z.enum(["ai", "agent"]),
  characters: z.number().int().nonnegative().max(AI_INPUT_MAX),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Adopting AI copy is still drafting, so it needs the reply permission; editing
  // your own text only needs the assist permission to be meaningful.
  if (!canReplyToConversation(session.user.role) && !canUseAiAssist(session.user.role)) {
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
  const result = demoConversationStore().recordDraftEdit(id, {
    actor: session.user.name,
    action: parsed.data.action,
    source: parsed.data.source,
    characters: Math.min(parsed.data.characters, MESSAGE_BODY_MAX),
  });
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ event: toAuditEventDto(result.event) });
}