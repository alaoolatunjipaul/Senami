import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { toInboxConversationDto } from "@/lib/domain/inbox";
import { getSessionFromCookies } from "@/server/auth/session";
import { demoInboxStore } from "@/server/inbox/store";
import { can } from "@/server/rbac/permissions";

/**
 * POST /api/conversations/:id/read
 *
 * Sets the read state of one conversation. This is a real mutation against the
 * store (the inbox counts and card styling update after it), not a cosmetic
 * toggle. Body: `{ "read": boolean }`.
 */

const bodySchema = z.object({ read: z.boolean() });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "conversation.read")) {
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
      { error: "invalid_body", message: parsed.error.issues[0]?.message ?? "Invalid body." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const updated = demoInboxStore().markRead(id, parsed.data.read);
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, conversation: toInboxConversationDto(updated) });
}