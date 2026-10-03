import { describe, expect, it } from "vitest";

import {
  conversationMatchesTerm,
  dateWindowFromQuery,
  describeDateSelection,
  matchesInboxQuery,
  matchesInboxDate,
  normaliseIsoDate,
  toIsoDate,
  withinDatePreset,
  withinDateWindow,
  DEFAULT_INBOX_QUERY,
  type InboxConversation,
  type InboxQuery,
} from "@/lib/domain/inbox";
import {
  INTERACTION_ID_PATTERN,
  interactionIdFor,
  interactionReference,
  isInteractionId,
  normaliseInteractionId,
} from "@/lib/domain/interaction-id";

/**
 * Interaction identity and interaction search/date filtering.
 *
 * These cover the three behaviours the interaction history depends on: a
 * reference that is deterministic, unique and stable; a search that resolves a
 * pasted reference to exactly one interaction while still matching names,
 * handles and message text; and a calendar selection that filters real
 * timestamps rather than a hard-coded bucket.
 */

const NOW = new Date("2026-09-18T12:00:00.000Z");

function conv(overrides: Partial<InboxConversation> = {}): InboxConversation {
  return {
    id: "cv_0001",
    interactionId: "INT-SOC-20260918-00001",
    channel: "instagram",
    customer: { id: "cus_1", name: "Maya Keller", handle: "@mayakeller88" },
    receivedAt: new Date("2026-09-18T09:00:00.000Z"),
    lastMessageAt: new Date("2026-09-18T11:30:00.000Z"),
    respondedAt: null,
    preview: "My card was declined twice today",
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

function query(overrides: Partial<InboxQuery> = {}): InboxQuery {
  return { ...DEFAULT_INBOX_QUERY, ...overrides };
}

describe("interaction references", () => {
  it("builds a readable reference from channel, day and sequence", () => {
    expect(interactionIdFor("instagram", new Date("2026-10-01T09:00:00.000Z"), 421)).toBe(
      "INT-SOC-20261001-00421",
    );
  });

  it("is deterministic for the same channel, day and sequence", () => {
    const at = new Date("2026-10-01T09:00:00.000Z");
    expect(interactionIdFor("x", at, 7)).toBe(interactionIdFor("x", at, 7));
  });

  it("distinguishes the same sequence on different days", () => {
    const first = interactionIdFor("instagram", new Date("2026-10-01T09:00:00.000Z"), 1);
    const second = interactionIdFor("instagram", new Date("2026-10-02T09:00:00.000Z"), 1);
    expect(first).not.toBe(second);
    expect(first < second).toBe(true);
  });

  it("zero-pads the sequence to five digits", () => {
    expect(interactionIdFor("tiktok", NOW, 7)).toMatch(INTERACTION_ID_PATTERN);
    expect(interactionIdFor("tiktok", NOW, 7)).toContain("-00007");
  });

  it("clamps a nonsensical sequence instead of producing a broken reference", () => {
    expect(interactionIdFor("facebook", NOW, 0)).toContain("-00001");
    expect(interactionIdFor("facebook", NOW, -5)).toContain("-00001");
  });

  it("recognises and normalises operator input", () => {
    expect(isInteractionId("INT-SOC-20261001-00421")).toBe(true);
    expect(isInteractionId("int-soc-20261001-00421")).toBe(true);
    expect(isInteractionId("Maya Keller")).toBe(false);
    expect(normaliseInteractionId("  int-soc-20261001-00421 ")).toBe("INT-SOC-20261001-00421");
  });

  it("falls back to the internal id when a row predates references", () => {
    expect(interactionReference({ id: "cv_0007" })).toBe("cv_0007");
    expect(interactionReference({ id: "cv_0007", interactionId: "INT-SOC-20261001-00421" })).toBe(
      "INT-SOC-20261001-00421",
    );
  });
});

describe("interaction search", () => {
  const target = conv();
  const other = conv({
    id: "cv_0002",
    interactionId: "INT-SOC-20260917-00009",
    customer: { id: "cus_2", name: "Jon Bell", handle: "@jonbell" },
    preview: "Where is my statement",
    receivedAt: new Date("2026-09-17T09:00:00.000Z"),
    lastMessageAt: new Date("2026-09-17T10:00:00.000Z"),
  });

  it("resolves a complete reference to exactly that interaction", () => {
    expect(conversationMatchesTerm(target, "INT-SOC-20260918-00001")).toBe(true);
    expect(conversationMatchesTerm(other, "INT-SOC-20260918-00001")).toBe(false);
  });

  it("tolerates a lower-cased pasted reference", () => {
    expect(conversationMatchesTerm(target, "int-soc-20260918-00001")).toBe(true);
  });

  it("matches on customer name, social handle and message text", () => {
    expect(conversationMatchesTerm(target, "maya")).toBe(true);
    expect(conversationMatchesTerm(target, "@mayakeller88")).toBe(true);
    expect(conversationMatchesTerm(target, "declined twice")).toBe(true);
    expect(conversationMatchesTerm(other, "@mayakeller88")).toBe(false);
  });

  it("keeps a partial reference a substring search rather than an exact lookup", () => {
    expect(conversationMatchesTerm(target, "20260918")).toBe(true);
    expect(conversationMatchesTerm(other, "20260918")).toBe(false);
  });

  it("filters the list through the query, not only the search box", () => {
    expect(matchesInboxQuery(target, query({ search: "@mayakeller88" }), NOW)).toBe(true);
    expect(matchesInboxQuery(other, query({ search: "@mayakeller88" }), NOW)).toBe(false);
    expect(matchesInboxQuery(target, query({ search: "INT-SOC-20260918-00001" }), NOW)).toBe(true);
  });
});

describe("calendar selection", () => {
  it("normalises only real ISO calendar days", () => {
    expect(normaliseIsoDate("2026-09-18")).toBe("2026-09-18");
    expect(normaliseIsoDate("2026-9-18")).toBe("");
    expect(normaliseIsoDate("2026-02-31")).toBe("");
    expect(normaliseIsoDate(null)).toBe("");
  });

  it("renders a local calendar day", () => {
    expect(toIsoDate(new Date(2026, 8, 18))).toBe("2026-09-18");
  });

  it("treats a single selected day as a one-day window", () => {
    const window = dateWindowFromQuery({ dateFrom: "2026-09-18", dateTo: "2026-09-18" });
    expect(window).not.toBeNull();
    expect(withinDateWindow(conv(), window!)).toBe(true);
  });

  it("returns interactions from an arbitrary selected calendar day", () => {
    const onThe18th = conv();
    const onThe19th = conv({
      receivedAt: new Date("2026-09-19T08:00:00.000Z"),
      lastMessageAt: new Date("2026-09-19T09:00:00.000Z"),
    });
    expect(
      matchesInboxQuery(onThe18th, query({ date: "custom", dateFrom: "2026-09-18", dateTo: "2026-09-18" }), NOW),
    ).toBe(true);
    expect(
      matchesInboxQuery(onThe19th, query({ date: "custom", dateFrom: "2026-09-18", dateTo: "2026-09-18" }), NOW),
    ).toBe(false);
  });

  it("includes an interaction that was still being answered on the selected day", () => {
    const spanning = conv({
      receivedAt: new Date("2026-09-10T08:00:00.000Z"),
      lastMessageAt: new Date("2026-09-18T09:00:00.000Z"),
    });
    expect(
      matchesInboxQuery(spanning, query({ date: "custom", dateFrom: "2026-09-18", dateTo: "2026-09-18" }), NOW),
    ).toBe(true);
  });

  it("spans a custom range from the first day through the end of the last", () => {
    const window = dateWindowFromQuery({ dateFrom: "2026-09-16", dateTo: "2026-09-18" });
    expect(withinDateWindow(conv(), window!)).toBe(true);
    expect(
      withinDateWindow(
        conv({ receivedAt: new Date("2026-09-19T08:00:00.000Z"), lastMessageAt: new Date("2026-09-19T09:00:00.000Z") }),
        window!,
      ),
    ).toBe(false);
  });

  it("tolerates a reversed range", () => {
    const window = dateWindowFromQuery({ dateFrom: "2026-09-18", dateTo: "2026-09-16" });
    expect(window).toEqual(dateWindowFromQuery({ dateFrom: "2026-09-16", dateTo: "2026-09-18" }));
  });

  it("describes the selection for the trigger label", () => {
    expect(describeDateSelection({ date: "custom", dateFrom: "2026-09-18", dateTo: "2026-09-18" })).toContain(
      "2026",
    );
    expect(describeDateSelection({ date: "today", dateFrom: "", dateTo: "" })).toBe("Today");
  });

  it("falls back to the preset when no explicit day is set", () => {
    expect(dateWindowFromQuery({ dateFrom: "", dateTo: "" })).toBeNull();
    expect(matchesInboxDate(conv(), { date: "today", dateFrom: "", dateTo: "" }, NOW)).toBe(true);
    expect(
      matchesInboxDate(
        conv({ receivedAt: new Date("2026-09-01T08:00:00.000Z"), lastMessageAt: new Date("2026-09-01T09:00:00.000Z") }),
        { date: "today", dateFrom: "", dateTo: "" },
        NOW,
      ),
    ).toBe(false);
  });

  it("keeps the preset definitions honest", () => {
    // Presets are calendar-day concepts, so these use local-time constructors
    // rather than UTC instants; the assertions hold in any timezone.
    const at = (year: number, month: number, day: number, hour = 12) =>
      new Date(year, month - 1, day, hour).getTime();

    expect(withinDatePreset("yesterday", new Date(at(2026, 9, 17)), NOW)).toBe(true);
    expect(withinDatePreset("yesterday", new Date(at(2026, 9, 16)), NOW)).toBe(false);
    expect(withinDatePreset("yesterday", new Date(at(2026, 9, 18, 23)), NOW)).toBe(false);
    expect(withinDatePreset("today", new Date(at(2026, 9, 18, 0)), NOW)).toBe(true);
    expect(withinDatePreset("thisMonth", new Date(at(2026, 9, 1, 1)), NOW)).toBe(true);
    expect(withinDatePreset("lastMonth", new Date(at(2026, 8, 31, 23)), NOW)).toBe(true);
    expect(withinDatePreset("lastMonth", new Date(at(2026, 9, 1, 1)), NOW)).toBe(false);
    expect(withinDatePreset("thisWeek", new Date(at(2026, 9, 14)), NOW)).toBe(true);
    expect(withinDatePreset("lastWeek", new Date(at(2026, 9, 10)), NOW)).toBe(true);
  });

  it("composes with search and the other filters", () => {
    const scoped = query({
      search: "@mayakeller88",
      date: "custom",
      dateFrom: "2026-09-18",
      dateTo: "2026-09-18",
      channels: ["instagram"],
    });
    expect(matchesInboxQuery(conv(), scoped, NOW)).toBe(true);
    expect(matchesInboxQuery(conv({ channel: "facebook" }), scoped, NOW)).toBe(false);
  });

  it("restores every interaction once the date filter is cleared", () => {
    const filtered = matchesInboxQuery(conv(), query({ date: "custom", dateFrom: "2026-09-18", dateTo: "2026-09-18" }), NOW);
    const cleared = matchesInboxQuery(conv(), query(), NOW);
    expect(filtered).toBe(true);
    expect(cleared).toBe(true);
  });
});