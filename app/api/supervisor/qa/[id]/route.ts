import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  QA_CHECK_OUTCOMES,
  QA_REVIEW_NOTE_MAX,
  QA_REVIEW_STATUSES,
  validateQaDecision,
} from "@/lib/domain/qa-review";
import { getSessionFromCookies } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";
import { demoSupervisorStore } from "@/server/supervisor/store";

/**
 * POST /api/supervisor/qa/:id (§26 QA Review)
 *
 * Record a QA decision. Validation runs through the same `validateQaDecision` the
 * dialog uses, so a crafted request cannot skip a mandatory check or approve a
 * reply that still has a failing criterion.
 *
 * A status of `in_review` only claims the item; it is not a decision, so it
 * answers `204` rather than a review row.
 */

const bodySchema = z.object({
  /**
   * Declared key by key rather than as a record so the API rejects a typo in a
   * check name instead of silently dropping it into a review that then looks
   * complete.
   */
  checks: z
    .object({
      accuracy: z.enum(QA_CHECK_OUTCOMES).optional(),
      tone: z.enum(QA_CHECK_OUTCOMES).optional(),
      privacy: z.enum(QA_CHECK_OUTCOMES).optional(),
      compliance: z.enum(QA_CHECK_OUTCOMES).optional(),
    })
    .default({}),
  status: z.enum(QA_REVIEW_STATUSES),
  note: z.string().max(QA_REVIEW_NOTE_MAX).default(""),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "supervisor.qa.review")) {
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

  const { checks, status, note } = parsed.data;

  // Non-decision statuses claim the item without judging it, so the mandatory
  // checks do not apply yet.
  if (status !== "approved" && status !== "changes_requested") {
    const claimed = demoSupervisorStore().decideQa(
      (await context.params).id,
      { checks, status, note, actorId: session.user.id, actorName: session.user.name },
    );
    return claimed === null ? NextResponse.json({ error: "not_found" }, { status: 404 }) : new NextResponse(null, { status: 204 });
  }

  const validation = validateQaDecision(checks, status, note);
  if (!validation.valid) {
    return NextResponse.json({ error: "invalid_review", errors: validation.errors }, { status: 400 });
  }

  const { id } = await context.params;
  const store = demoSupervisorStore();
  const result = store.decideQa(id, {
    checks,
    status,
    note,
    actorId: session.user.id,
    actorName: session.user.name,
  });

  if (result === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if ("errors" in result) {
    return NextResponse.json({ error: "invalid_review", errors: result.errors }, { status: 400 });
  }

  return NextResponse.json(result);
}
