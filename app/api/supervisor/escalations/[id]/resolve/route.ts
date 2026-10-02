import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ESCALATION_OUTCOMES } from "@/lib/domain/escalation";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * POST /api/supervisor/escalations/:id/resolve (§26)
 *
 * Deal with an escalation by returning the conversation to the live queue.
 *
 * This is deliberately *not* a resolution: resolving a conversation is a separate
 * authority (`conversation.resolve`) that a supervisor does not hold. Deciding an
 * escalation no longer needs supervisor attention is a narrower, different act,
 * and conflating the two would hand supervisors a way to close conversations they
 * were never given authority over.
 */

export const RESOLVE_NOTE_MAX = 1000;

const bodySchema = z.object({
  outcome: z.enum(ESCALATION_OUTCOMES),
  note: z.string().max(RESOLVE_NOTE_MAX).default(""),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.escalation.resolve")) {
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
  const store = demoSupervisorStore();

  if (!store.rows().some((row) => row.id === id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = store.resolveEscalation(id, {
    outcome: parsed.data.outcome,
    note: parsed.data.note,
    actorId: session.user.id,
    actorName: session.user.name,
  });
  if (!result) {
    // The conversation exists but is not escalated, so there is nothing to decide.
    return NextResponse.json({ error: "not_escalated" }, { status: 409 });
  }

  return NextResponse.json(result);
}
