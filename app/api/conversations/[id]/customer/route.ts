import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { toCustomerHistoryDto } from "@/lib/domain/conversation";
import { toCustomerContextDto } from "@/lib/domain/customer";
import { getSessionFromCookies } from "@/server/auth/session";
import { canViewConversation } from "@/server/conversations/policy";
import { demoConversationStore } from "@/server/conversations/store";
import { customerContextFor } from "@/server/customers/store";

/**
 * GET /api/conversations/:id/customer
 *
 * The customer context an agent reads before replying: who they are, what is
 * still open on their account, previous conversations, and interaction history.
 * Derived from the same dataset as the inbox, so it can never disagree with it.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canViewConversation(session.user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const store = demoConversationStore();
  const conversation = store.getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const customer = customerContextFor(conversation.customer.id);
  if (!customer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    customer: toCustomerContextDto(customer),
    history: toCustomerHistoryDto(customer.history),
  });
}