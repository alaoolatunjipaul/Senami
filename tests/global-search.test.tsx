import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearch } from "@/features/shell/global-search";
import type { SearchResultGroup } from "@/features/shell/global-search";

const GROUPS: readonly SearchResultGroup[] = [
  {
    id: "customers",
    label: "Customers",
    items: [
      { id: "c1", label: "Maya Keller", sublabel: "maya@example.com", href: "/customers/c1" },
    ],
  },
  {
    id: "conversations",
    label: "Conversations",
    items: [
      { id: "t1", label: "Refund not received", sublabel: "Instagram", href: "/inbox/t1" },
      { id: "t2", label: "Wrong item delivered", sublabel: "X", href: "/inbox/t2" },
    ],
  },
];

const DEBOUNCE_MS = 300;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function searchThenAdvance(input: HTMLElement, query: string) {
  fireEvent.change(input, { target: { value: query } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50);
  });
}

describe("GlobalSearch", () => {
  it("does not query before the minimum query length", async () => {
    const search = vi.fn(() => []);
    const { container } = render(<GlobalSearch search={search} minQuery={2} />);
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "m" } });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50);

    expect(search).not.toHaveBeenCalled();
  });

  it("debounces rapid input into a single lookup", async () => {
    const search = vi.fn(() => GROUPS);
    const { container } = render(<GlobalSearch search={search} />);
    const input = container.querySelector("input") as HTMLInputElement;

    for (const value of ["ma", "may", "maya"]) {
      fireEvent.change(input, { target: { value } });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50);
    });

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("maya");
  });

  it("renders grouped results and always announces the group label", async () => {
    const { container } = render(<GlobalSearch search={() => GROUPS} />);
    const input = container.querySelector("input") as HTMLInputElement;

    await searchThenAdvance(input, "maya");

    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Maya Keller")).toBeInTheDocument();
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Refund not received")).toBeInTheDocument();
  });

  it("hides empty groups so a group header is never blank", async () => {
    const groups: readonly SearchResultGroup[] = [
      { id: "customers", label: "Customers", items: [] },
      { id: "conversations", label: "Conversations", items: GROUPS[1]?.items ?? [] },
    ];
    const { container } = render(<GlobalSearch search={() => groups} />);
    const input = container.querySelector("input") as HTMLInputElement;

    await searchThenAdvance(input, "maya");

    expect(screen.queryByText("Customers")).not.toBeInTheDocument();
    expect(screen.getByText("Refund not received")).toBeInTheDocument();
  });

  it("shows an honest empty state when nothing matches", async () => {
    const { container } = render(<GlobalSearch search={() => []} />);
    const input = container.querySelector("input") as HTMLInputElement;

    await searchThenAdvance(input, "zzz");

    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });

  it("navigates with the keyboard across grouped results", async () => {
    const onNavigate = vi.fn();
    const { container } = render(<GlobalSearch search={() => GROUPS} onNavigate={onNavigate} />);
    const input = container.querySelector("input") as HTMLInputElement;

    await searchThenAdvance(input, "maya");

    const combobox = screen.getByRole("combobox");
    expect(combobox.getAttribute("aria-activedescendant")).toBeNull();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(combobox.getAttribute("aria-activedescendant")).toBe("search-result-c1");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(combobox.getAttribute("aria-activedescendant")).toBe("search-result-t1");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onNavigate).toHaveBeenCalledWith("/inbox/t1");
  });

  it("selects a highlighted option with a click", async () => {
    const onNavigate = vi.fn();
    const { container } = render(<GlobalSearch search={() => GROUPS} onNavigate={onNavigate} />);
    const input = container.querySelector("input") as HTMLInputElement;

    await searchThenAdvance(input, "maya");

    fireEvent.click(screen.getByText("Refund not received"));
    expect(onNavigate).toHaveBeenCalledWith("/inbox/t1");
  });
});
