import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomerContextPane } from "@/features/conversation/customer-context-pane";
import { DateFilter } from "@/features/inbox/date-filter";
import { DEFAULT_INBOX_QUERY, type InboxQuery } from "@/lib/domain/inbox";
import type { CustomerContextDto } from "@/lib/domain/customer";

/**
 * Interaction history UI.
 *
 * Covers the two surfaces an agent actually touches: the calendar control that
 * turns a chosen day or range into a query, and the docked customer context
 * pane whose history rows carry the interaction reference and open the previous
 * interaction.
 */

const NOW = new Date("2026-09-18T12:00:00.000Z");

function query(overrides: Partial<InboxQuery> = {}): InboxQuery {
  return { ...DEFAULT_INBOX_QUERY, ...overrides };
}

describe("DateFilter", () => {
  it("shows the current selection and offers every requested shortcut", () => {
    render(<DateFilter query={query()} onPatch={() => {}} onClearDates={() => {}} />);

    const trigger = screen.getByRole("button", { name: /any time/i });
    fireEvent.click(trigger);

    for (const label of [
      "Today",
      "Yesterday",
      "Last 7 days",
      "Last 30 days",
      "This week",
      "Last week",
      "This month",
      "Last month",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("renders a month grid the agent can pick any day from", () => {
    render(<DateFilter query={query()} onPatch={() => {}} onClearDates={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /any time/i }));

    const dialog = screen.getByRole("dialog", { name: /filter interactions by date/i });
    // 18 September 2026 is a Friday; the grid must offer that exact day.
    expect(within(dialog).getByRole("button", { name: "18" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next month/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous month/i })).toBeInTheDocument();
  });

  it("writes a single selected day as a one-day custom range", () => {
    const onPatch = vi.fn();
    render(<DateFilter query={query()} onPatch={onPatch} onClearDates={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /any time/i }));

    fireEvent.click(screen.getByRole("button", { name: "18" }));

    // The calendar opens on the current month, so the expected day is derived
    // from the clock rather than hard-coded to a fixed month.
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-18`;
    expect(onPatch).toHaveBeenCalledWith({
      date: "custom",
      dateFrom: expected,
      dateTo: expected,
    });
  });

  it("completes a range on the second click", () => {
    const onPatch = vi.fn();
    render(
      <DateFilter
        query={query({ date: "custom", dateFrom: "2026-09-10", dateTo: "" })}
        onPatch={onPatch}
        onClearDates={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /10/ }));

    fireEvent.click(screen.getByRole("button", { name: "18" }));

    expect(onPatch).toHaveBeenCalledWith({
      date: "custom",
      dateFrom: "2026-09-10",
      dateTo: "2026-09-18",
    });
  });

  it("clears an explicit selection back to any time", () => {
    const onClearDates = vi.fn();
    render(
      <DateFilter
        query={query({ date: "custom", dateFrom: "2026-09-18", dateTo: "2026-09-18" })}
        onPatch={() => {}}
        onClearDates={onClearDates}
      />,
    );
    expect(screen.getByRole("button", { name: /2026/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /2026/ }));
    fireEvent.click(screen.getByRole("button", { name: /clear date filter/i }));

    expect(onClearDates).toHaveBeenCalled();
  });

  it("applies a shortcut without leaving a stale explicit range", () => {
    const onPatch = vi.fn();
    render(
      <DateFilter
        query={query({ date: "custom", dateFrom: "2026-09-18", dateTo: "2026-09-18" })}
        onPatch={onPatch}
        onClearDates={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "Yesterday" }));

    expect(onPatch).toHaveBeenCalledWith({ date: "yesterday", dateFrom: "", dateTo: "" });
  });
});

function customerDto(overrides: Partial<CustomerContextDto> = {}): CustomerContextDto {
  return {
    name: "Maya Keller",
    handle: "mayakeller88",
    account: {
      reference: "CUS-0042",
      verified: true,
      since: "2024-02-01T00:00:00.000Z",
      preferredChannel: "instagram",
      segment: "premium",
    },
    channels: ["instagram", "facebook"],
    tags: ["priority"],
    openIssues: [],
    interactionCount: 3,
    firstInteractionAt: "2026-07-02T09:00:00.000Z",
    lastInteractionAt: "2026-09-18T11:30:00.000Z",
    history: {
      customer: { id: "cus_1", name: "Maya Keller", handle: "@mayakeller88" },
      totalConversations: 3,
      openConversations: 1,
      resolvedConversations: 2,
      firstContactAt: "2026-07-02T09:00:00.000Z",
      lastContactAt: "2026-09-18T11:30:00.000Z",
      recent: [
        {
          id: "cv_0001",
          interactionId: "INT-SOC-20260918-00001",
          channel: "instagram",
          intent: "card_issue",
          status: "open",
          priority: "high",
          preview: "My card was declined twice today",
          receivedAt: "2026-09-18T09:00:00.000Z",
          lastMessageAt: "2026-09-18T11:30:00.000Z",
          assignedTo: { id: "agt_1", name: "Ana Ruiz", teamId: "team_1", teamName: "Payments" },
        },
        {
          id: "cv_0002",
          interactionId: "INT-SOC-20260811-00007",
          channel: "facebook",
          intent: "transfer",
          status: "resolved",
          priority: "normal",
          preview: "Asked for a summary of last month's fees",
          receivedAt: "2026-08-11T08:00:00.000Z",
          lastMessageAt: "2026-08-11T09:00:00.000Z",
          assignedTo: null,
        },
      ],
    },
    recentInteractions: [],
    ...overrides,
  } as CustomerContextDto;
}

describe("CustomerContextPane", () => {
  it("shows previous interactions with their reference, channel, agent and status", () => {
    render(
      <CustomerContextPane
        customer={customerDto()}
        loading={false}
        error={false}
        onRetry={() => {}}
        activeConversationId="cv_0002"
        onOpenInteraction={() => {}}
        now={NOW}
      />,
    );

    expect(screen.getByText("INT-SOC-20260918-00001")).toBeInTheDocument();
    expect(screen.getByText("INT-SOC-20260811-00007")).toBeInTheDocument();
    expect(screen.getByText("My card was declined twice today")).toBeInTheDocument();
    expect(screen.getByText("Asked for a summary of last month's fees")).toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("opens a previous interaction when its row is activated", () => {
    const onOpenInteraction = vi.fn();
    render(
      <CustomerContextPane
        customer={customerDto()}
        loading={false}
        error={false}
        onRetry={() => {}}
        activeConversationId="cv_0002"
        onOpenInteraction={onOpenInteraction}
        now={NOW}
      />,
    );

    fireEvent.click(screen.getByText("INT-SOC-20260918-00001").closest("button") as HTMLElement);

    expect(onOpenInteraction).toHaveBeenCalledWith("cv_0001");
  });

  it("marks the interaction that is currently open", () => {
    render(
      <CustomerContextPane
        customer={customerDto()}
        loading={false}
        error={false}
        onRetry={() => {}}
        activeConversationId="cv_0001"
        onOpenInteraction={() => {}}
        now={NOW}
      />,
    );

    const current = screen.getByText("INT-SOC-20260918-00001").closest("button");
    expect(current).toHaveAttribute("aria-current", "true");
  });

  it("reports a load failure without hiding the conversation", () => {
    const onRetry = vi.fn();
    render(
      <CustomerContextPane
        customer={null}
        loading={false}
        error
        onRetry={onRetry}
        activeConversationId="cv_0001"
        onOpenInteraction={() => {}}
        now={NOW}
      />,
    );

    expect(screen.getByText(/unable to load customer context/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});