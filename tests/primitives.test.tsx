import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Avatar, getInitials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Pagination } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { SLAIndicator } from "@/components/ui/sla-indicator";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { EmptyState, ErrorState, LoadingState, OfflineBanner } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluateSla, MINUTE_MS } from "@/lib/domain/sla";

describe("Button", () => {
  it("defaults to type=button so it cannot submit a form by accident", () => {
    render(<Button>Send</Button>);

    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "button");
  });

  it("applies a variant class", () => {
    render(<Button variant="danger">Delete</Button>);

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("bg-critical");
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Send
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders as a child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/inbox">Go to inbox</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Go to inbox" });
    expect(link).toHaveClass("bg-primary");
    // A Slot must not receive an injected type attribute.
    expect(link).not.toHaveAttribute("type");
  });
});

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge tone="critical">High Priority</Badge>);

    expect(screen.getByText("High Priority")).toBeInTheDocument();
  });

  it("exposes an accessible prefix without changing the visible text", () => {
    render(
      <Badge tone="critical" srPrefix="Priority">
        High
      </Badge>,
    );

    expect(screen.getByText("Priority:")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });
});

describe("StatusIndicator", () => {
  it("renders a visible label so state is never colour-only", () => {
    render(<StatusIndicator tone="critical" label="Escalated" />);

    expect(screen.getByText("Escalated")).toBeInTheDocument();
  });

  it("uses sr-only text when the visible label is abbreviated", () => {
    render(<StatusIndicator tone="info" label="IG" srLabel="Instagram" />);

    expect(screen.getByText("Instagram")).toHaveClass("sr-only");
  });
});

describe("SLAIndicator", () => {
  const policy = { firstResponseMinutes: 60, warningMinutes: 15 };
  const startedAt = new Date("2026-09-01T09:00:00.000Z");

  it("shows the computed countdown", () => {
    const evaluation = evaluateSla({
      policy,
      startedAt,
      now: new Date(startedAt.getTime() + 30 * MINUTE_MS),
    });

    render(<SLAIndicator evaluation={evaluation} />);
    expect(screen.getByText("30m remaining")).toBeInTheDocument();
  });

  it("announces the state in addition to the countdown", () => {
    const evaluation = evaluateSla({
      policy,
      startedAt,
      now: new Date(startedAt.getTime() + 72 * MINUTE_MS),
    });

    render(<SLAIndicator evaluation={evaluation} />);
    expect(screen.getByText("12m over SLA")).toBeInTheDocument();
    expect(screen.getByText(/Breached/)).toBeInTheDocument();
  });

  it("hides the countdown in compact mode but keeps the state accessible", () => {
    const evaluation = evaluateSla({ policy, startedAt, now: startedAt });

    render(<SLAIndicator evaluation={evaluation} compact />);
    expect(screen.queryByText("1h remaining")).not.toBeInTheDocument();
    expect(screen.getByText("On track")).toBeInTheDocument();
  });
});

describe("Avatar", () => {
  it("derives initials from a name", () => {
    expect(getInitials("Maya Keller")).toBe("MK");
    expect(getInitials("David")).toBe("DA");
    expect(getInitials("  ")).toBe("?");
  });

  it("exposes the full name as the accessible name", () => {
    render(<Avatar name="Maya Keller" />);

    expect(screen.getByRole("img", { name: "Maya Keller" })).toHaveTextContent("MK");
  });

  it("assigns a deterministic tone for the same person", () => {
    const { unmount } = render(<Avatar name="Maya Keller" />);
    const first = screen.getByRole("img").className;
    unmount();

    render(<Avatar name="Maya Keller" />);
    expect(screen.getByRole("img").className).toBe(first);
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive technology but labelled as loading", () => {
    render(<Skeleton label="Loading queue" />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Loading queue")).toBeInTheDocument();
  });
});

describe("screen states", () => {
  it("EmptyState shows the title, description and action", () => {
    render(
      <EmptyState
        title="No conversations found"
        description="Try changing your filters."
        action={<Button>Clear filters</Button>}
      />,
    );

    expect(screen.getByText("No conversations found")).toBeInTheDocument();
    expect(screen.getByText("Try changing your filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("ErrorState is an alert, shows the request ID and retries", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState title="Unable to load conversations" requestId="req_123" onRetry={onRetry} />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("req_123")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("ErrorState disables the retry button while a retry is in flight", () => {
    render(<ErrorState onRetry={() => undefined} retrying />);

    expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();
  });

  it("LoadingState announces itself politely", () => {
    render(<LoadingState label="Loading conversations" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading conversations")).toBeInTheDocument();
  });

  it("OfflineBanner renders nothing while online", () => {
    const { container } = render(<OfflineBanner isOffline={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("OfflineBanner explains the consequence when offline", () => {
    render(<OfflineBanner isOffline />);

    expect(screen.getByRole("status")).toHaveTextContent(/Connection lost/);
  });
});

describe("DataTable", () => {
  interface Row {
    id: string;
    name: string;
  }

  const rows: Row[] = [
    { id: "1", name: "Maya Keller" },
    { id: "2", name: "David Ade" },
  ];

  const columns = [{ id: "name", header: "Customer", cell: (row: Row) => row.name }];

  it("renders a labelled table with rows", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Assigned conversations"
      />,
    );

    expect(screen.getByRole("table", { name: "Assigned conversations" })).toBeInTheDocument();
    expect(screen.getByText("Maya Keller")).toBeInTheDocument();
    expect(screen.getByText("David Ade")).toBeInTheDocument();
  });

  it("marks the table busy and shows skeletons while loading", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        caption="Assigned conversations"
        loading
        skeletonRows={2}
      />,
    );

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("Maya Keller")).not.toBeInTheDocument();
  });

  it("shows the empty state instead of a blank table", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        caption="Assigned conversations"
        emptyTitle="No conversations found"
        emptyDescription="Try changing your filters."
      />,
    );

    expect(screen.getByText("No conversations found")).toBeInTheDocument();
    expect(screen.getByText("Try changing your filters.")).toBeInTheDocument();
  });

  it("shows the error state with a retry when loading fails", async () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        caption="Assigned conversations"
        error={{ requestId: "req_abc" }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("Pagination", () => {
  it("disables Previous on the first page and Next on the last", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination page={1} pageSize={20} total={45} onPageChange={onPageChange} />,
    );

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByText("1-20 of 45")).toBeInTheDocument();

    rerender(<Pagination page={3} pageSize={20} total={45} onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("41-45 of 45")).toBeInTheDocument();
  });

  it("requests the next page", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={20} total={45} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe("Modal", () => {
  it("renders a labelled dialog when open and closes on escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <Modal
        open
        onOpenChange={onOpenChange}
        title="Escalate conversation"
        description="Route this conversation to another team"
      >
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Escalate conversation" });
    expect(dialog).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides its content when closed", () => {
    render(
      <Modal open={false} onOpenChange={() => undefined} title="Escalate conversation">
        <p>Body</p>
      </Modal>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
