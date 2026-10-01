import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { toCustomerHistoryDto } from "@/lib/domain/conversation";
import { getSessionFromCookies } from "@/server/auth/session";
import { demoConversationStore } from "@/server/conversations/store";
import { can } from "@/server/rbac/permissions";

/**
 * GET /api/conversations/:id/history
 *
 * Customer history and the customer's other conversations, surfaced by the
 * "Customer History" action. Read-only and derived from the mock dataset.
 */
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
  const conversation = store.getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const history = store.customerHistory(conversation.customer.id);
  if (!history) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(toCustomerHistoryDto(history));
}
