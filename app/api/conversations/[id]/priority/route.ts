import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { toAuditEventDto } from "@/lib/domain/conversation";
import { toInboxConversationDto } from "@/lib/domain/inbox";
import { PRIORITIES } from "@/lib/domain/taxonomy";
import { getSessionFromCookies } from "@/server/auth/session";
import { demoConversationStore } from "@/server/conversations/store";
import { can } from "@/server/rbac/permissions";

/**
 * PATCH /api/conversations/:id/priority (§11)
 *
 * Raise or lower a conversation's priority. Priority drives the first-response
 * deadline, so this is deliberately a supervisor-only action: an agent editing
 * their own priority could quietly shorten an SLA they are accountable for.
 */

const REASON_MAX = 500;

const bodySchema = z.object({
  priority: z.enum(PRIORITIES),
  reason: z.string().max(REASON_MAX).default(""),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.priority.change")) {
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
  if (!store.getConversation(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = store.changePriority(id, {
    priority: parsed.data.priority,
    reason: parsed.data.reason,
    actor: session.user.name,
  });
  if (!result) {
    return NextResponse.json({ error: "unchanged" }, { status: 409 });
  }

  return NextResponse.json({
    conversation: toInboxConversationDto(result.conversation),
    event: toAuditEventDto(result.event),
  });
}
