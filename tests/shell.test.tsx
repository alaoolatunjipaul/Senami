import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/features/shell/app-shell";
import { NotificationsPopover } from "@/features/shell/notifications";
import { ProfileMenu } from "@/features/shell/profile-menu";
import { Sidebar } from "@/features/shell/sidebar";
import { deriveInitials, type Session } from "@/lib/domain/user";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inbox",
}));

function session(
  overrides: Partial<{
    name: string;
    email: string;
    role: Session["user"]["role"];
    teamId: string | null;
  }> = {},
): Session {
  const user = {
    id: "user_1",
    name: overrides.name ?? "Maya Keller",
    email: overrides.email ?? "maya@senami.test",
    role: overrides.role ?? "AGENT",
    teamId: overrides.teamId ?? null,
    initials: "",
  };
  return {
    id: "session_1",
    user: { ...user, initials: deriveInitials(user.name) },
    expiresAt: Date.now() + 28_800_000,
  };
}

describe("Sidebar", () => {
  it("shows agents the inbox and performance but no admin sections", () => {
    render(<Sidebar role="AGENT" />);

    expect(screen.getByText("My performance")).toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
    expect(screen.queryByText("Live queue")).not.toBeInTheDocument();
  });

  it("shows supervisors the live queue but not admin sections", () => {
    render(<Sidebar role="SUPERVISOR" />);

    expect(screen.getByText("Live queue")).toBeInTheDocument();
    expect(screen.queryByText("Users & teams")).not.toBeInTheDocument();
    expect(screen.queryByText("My performance")).not.toBeInTheDocument();
  });

  it("shows administrators administration and sorting views", () => {
    render(<Sidebar role="ADMIN" />);

    expect(screen.getByText("Users & teams")).toBeInTheDocument();
    expect(screen.getByText("Audit log")).toBeInTheDocument();
    expect(screen.queryByText("Inbox")).not.toBeInTheDocument();
  });

  it("marks the active route with aria-current and renders a count badge", () => {
    render(<Sidebar role="AGENT" counts={{ inbox: 14 }} />);

    const inbox = screen.getByRole("link", { name: /Inbox/ });
    expect(inbox).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("omits a count badge when no count is provided", () => {
    render(<Sidebar role="AGENT" />);
    expect(screen.queryByText("14")).not.toBeInTheDocument();
  });

  it("shows channel dots without fabricating counts", () => {
    render(<Sidebar role="AGENT" />);
    expect(screen.getByRole("link", { name: /Instagram/ })).toBeInTheDocument();
  });
});

describe("NotificationsPopover", () => {
  it("summarises unread notifications in the trigger label", () => {
    render(
      <NotificationsPopover
        items={[
          { id: "n1", title: "SLA breach", seen: false },
          { id: "n2", title: "Escalation", seen: false },
          { id: "n3", title: "Assignment", seen: true },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument();
  });

  it("opens to a progress-based empty state with no items", async () => {
    const user = userEvent.setup();
    render(<NotificationsPopover items={[]} />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("You are all caught up")).toBeInTheDocument();
  });

  it("renders every notification with its read state", async () => {
    const user = userEvent.setup();
    render(
      <NotificationsPopover
        items={[
          { id: "n1", title: "SLA breach", body: "C-104 is over its deadline", seen: false },
          { id: "n3", title: "Assignment", seen: true },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));

    expect(screen.getByText("SLA breach")).toBeInTheDocument();
    expect(screen.getByText("C-104 is over its deadline")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });
});

describe("ProfileMenu", () => {
  it("hides sign out while no logout handler exists", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu session={session()} />);

    await user.click(screen.getByRole("button", { name: "Account menu for Maya Keller" }));

    expect(screen.getByText("maya@senami.test")).toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("offers sign out and invokes the handler when provided", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(<ProfileMenu session={session({ role: "SUPERVISOR" })} onSignOut={onSignOut} />);

    await user.click(screen.getByRole("button", { name: "Account menu for Maya Keller" }));
    expect(screen.getAllByText("Supervisor").length).toBeGreaterThan(0);

    await user.click(screen.getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

describe("AppShell", () => {
  it("composes the banner, role-scoped sidebar, header and page", () => {
    render(
      <AppShell
        session={session({ role: "QA" })}
        search={() => []}
        notifications={[{ id: "n1", title: "New review assigned", seen: false }]}
      >
        <div>Review queue</div>
      </AppShell>,
    );

    expect(screen.getByText("DEMO ENVIRONMENT")).toBeInTheDocument();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("Review queue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();
  });
});
