import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConversationHeader } from "@/features/conversation/conversation-header";
import { channelLabel } from "@/lib/domain/channel-visuals";
import type { InboxConversationDto } from "@/lib/domain/inbox";
import {
  CONVERSATION_STATUS_META,
  INTENT_META,
  PRIORITY_META,
  SENTIMENT_META,
} from "@/lib/domain/taxonomy";
import { MINUTE_MS } from "@/lib/format";

const NOW = new Date("2026-05-20T12:00:00.000Z");

function dto(overrides: Partial<InboxConversationDto> = {}): InboxConversationDto {
  return {
    id: "cv_0001",
    channel: "instagram",
    customer: { id: "cus_1", name: "Maya Keller", handle: "@maya_keller" },
    receivedAt: new Date(NOW.getTime() - 30 * MINUTE_MS).toISOString(),
    lastMessageAt: new Date(NOW.getTime() - 5 * MINUTE_MS).toISOString(),
    respondedAt: null,
    preview: "My card was declined again at the till",
    intent: "card_issue",
    sentiment: "frustrated",
    priority: "high",
    status: "open",
    slaPaused: false,
    needsReview: false,
    assignedTo: null,
    unread: true,
    ...overrides,
  };
}

function renderHeader(props: Partial<ComponentProps<typeof ConversationHeader>> = {}) {
  const handlers = {
    onSetRead: vi.fn(),
    onShowCustomerHistory: vi.fn(),
    onShowConversationHistory: vi.fn(),
    onAssign: vi.fn(),
    onEscalate: vi.fn(),
    onMoveToPrivate: vi.fn(),
    onAddNote: vi.fn(),
    onShowAiAssist: vi.fn(),
    onShowResolve: vi.fn(),
  };
  render(
    <ConversationHeader
      conversation={props.conversation ?? dto()}
      now={NOW}
      unread={props.unread ?? true}
      updatingRead={false}
      canReply={props.canReply ?? true}
      canEscalate={props.canEscalate ?? true}
      canAssign={props.canAssign ?? true}
      canMoveToPrivate={props.canMoveToPrivate ?? true}
      canUseAi={props.canUseAi ?? true}
      canResolve={props.canResolve ?? true}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("ConversationHeader", () => {
  it("shows identity, channel, id and the triage snapshot", () => {
    renderHeader();

    expect(screen.getByText("Maya Keller")).toBeInTheDocument();
    expect(screen.getByText(`@maya_keller · ${channelLabel("instagram")}`)).toBeInTheDocument();
    expect(screen.getByText("cv_0001")).toBeInTheDocument();
    expect(screen.getByText(CONVERSATION_STATUS_META.open.label)).toBeInTheDocument();
    expect(screen.getByText(INTENT_META.card_issue)).toBeInTheDocument();
    expect(screen.getByText(SENTIMENT_META.frustrated.label)).toBeInTheDocument();
    expect(screen.getByText(PRIORITY_META.high.label)).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("toggles read state through the caller", () => {
    const handlers = renderHeader({ unread: true });
    fireEvent.click(screen.getByRole("button", { name: /mark read/i }));
    expect(handlers.onSetRead).toHaveBeenCalledWith(true);
  });

  it("raises each action and disables the ones the role cannot use", () => {
    const handlers = renderHeader({ canAssign: false, canEscalate: false, canMoveToPrivate: false });

    expect(screen.getByRole("button", { name: /assign/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /escalate/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /move to private/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /customer history/i }));
    fireEvent.click(screen.getByRole("button", { name: /conversation history/i }));
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    expect(handlers.onShowCustomerHistory).toHaveBeenCalledTimes(1);
    expect(handlers.onShowConversationHistory).toHaveBeenCalledTimes(1);
    expect(handlers.onAddNote).toHaveBeenCalledTimes(1);
  });

  it("enables the move-to-private action for a public conversation", () => {
    const handlers = renderHeader({ canMoveToPrivate: true });
    const move = screen.getByRole("button", { name: /move to private/i });
    expect(move).toBeEnabled();
    fireEvent.click(move);
    expect(handlers.onMoveToPrivate).toHaveBeenCalledTimes(1);
  });
});
