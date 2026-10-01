import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { AI_ACTIONS, AI_INPUT_MAX } from "@/lib/domain/ai";
import { getSessionFromCookies } from "@/server/auth/session";
import { AiActionError, runAssistant } from "@/server/agent/ai";
import { canUseAiAssist, canUseAiAssistOn } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";

/**
 * POST /api/conversations/:id/ai
 *
 * Runs one AI assistance action and returns an editable draft. The endpoint
 * never writes to the timeline: it cannot send a reply, and the response says so
 * explicitly so the client cannot imply otherwise (§8, §42).
 */

const bodySchema = z.object({
  action: z.enum(AI_ACTIONS),
  input: z.string().max(AI_INPUT_MAX).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canUseAiAssist(session.user.role)) {
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
      { error: "invalid_body", message: parsed.error.issues[0]?.message ?? "Invalid action." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const store = demoConversationStore();
  const thread = store.threadInfo(id);
  if (!store.getConversation(id) || !thread) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!canUseAiAssistOn(session.user.role, thread)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const result = runAssistant({
      conversationId: id,
      action: parsed.data.action,
      input: parsed.data.input,
      actor: session.user.name,
    });
    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiActionError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
    throw error;
  }
}