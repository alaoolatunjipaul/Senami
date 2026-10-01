import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_INBOX_QUERY } from "@/lib/domain/inbox";
import type { SearchResultGroup } from "@/lib/domain/search";
import { resetDemoInboxStore } from "@/server/inbox/store";
import { searchAll } from "@/server/search/search";

const NOW = new Date("2026-05-20T12:00:00.000Z");

function idsOf(groups: readonly SearchResultGroup[]): string[] {
  return groups.flatMap((group) => group.items.map((item) => item.id));
}

beforeEach(() => {
  resetDemoInboxStore(NOW);
});

describe("global search provider", () => {
  it("ignores terms that are too short", async () => {
    expect(await searchAll("")).toEqual([]);
    expect(await searchAll("a")).toEqual([]);
    expect(await searchAll("  x ")).toEqual([]);
  });

  it("finds conversations and customers by name, with deep links", async () => {
    const target = resetDemoInboxStore(NOW).list({ ...DEFAULT_INBOX_QUERY, pageSize: 1 }, NOW).items[0];
    if (!target) throw new Error("expected seeded data");

    const groups = await searchAll(target.customer.name);
    expect(groups.length).toBeGreaterThan(0);

    const conversations = groups.find((group) => group.id === "conversations");
    expect(conversations).toBeTruthy();
    expect(conversations?.items.length).toBeGreaterThan(0);
    expect(conversations?.items.every((item) => item.href.startsWith("/inbox?conversation="))).toBe(true);
    expect(conversations?.items.some((item) => item.label === target.customer.name)).toBe(true);
  });

  it("is case-insensitive and returns nothing for misses", async () => {
    const target = resetDemoInboxStore(NOW).list({ ...DEFAULT_INBOX_QUERY, pageSize: 1 }, NOW).items[0];
    if (!target) throw new Error("expected seeded data");

    const lower = await searchAll(target.customer.name.toLowerCase());
    const upper = await searchAll(target.customer.name.toUpperCase());

    expect(idsOf(lower)).toEqual(idsOf(upper));
    expect(await searchAll("zzzznomatch")).toEqual([]);
  });
});