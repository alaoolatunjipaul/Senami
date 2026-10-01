import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationCard } from "@/features/inbox/conversation-card";
import { HOUR_MS, MINUTE_MS } from "@/lib/format";
import type { InboxConversationDto } from "@/lib/domain/inbox";
import {
  CONVERSATION_STATUS_META,
  INTENT_META,
  PRIORITY_META,
  SENTIMENT_META,
} from "@/lib/domain/taxonomy";

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

describe("ConversationCard", () => {
  it("shows the real identity, preview and triage metadata", () => {
    render(<ConversationCard item={dto()} selected={false} onSelect={() => {}} now={NOW} />);

    expect(screen.getByText("Maya Keller")).toBeInTheDocument();
    expect(screen.getByText("@maya_keller")).toBeInTheDocument();
    expect(screen.getByText("My card was declined again at the till")).toBeInTheDocument();
    expect(screen.getByText(INTENT_META.card_issue)).toBeInTheDocument();
    expect(screen.getByText(SENTIMENT_META.frustrated.label)).toBeInTheDocument();
    expect(screen.getByText(PRIORITY_META.high.label)).toBeInTheDocument();
    expect(screen.getByText(CONVERSATION_STATUS_META.open.label)).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("reflects assignment, review flag and breached SLA", () => {
    render(
      <ConversationCard
        item={dto({
          assignedTo: { id: "usr_agent_kai", name: "Kai Nakamura", teamId: "t1", teamName: "Support · EU" },
          needsReview: true,
          receivedAt: new Date(NOW.getTime() - 4 * HOUR_MS).toISOString(),
        })}
        selected={false}
        onSelect={() => {}}
        now={NOW}
      />,
    );

    expect(screen.getByText("Assigned to Kai Nakamura")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Breached")).toBeInTheDocument();
  });

  it("reports selection and fires onSelect", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ConversationCard item={dto({ unread: false })} selected onSelect={onSelect} now={NOW} />,
    );

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-current")).toBe("true");
    expect(screen.queryByLabelText("Unread")).toBeNull();

    fireEvent.click(button as HTMLButtonElement);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});