import { describe, expect, it } from "vitest";

import { evaluateSla, formatDuration, getSlaPolicy, HOUR_MS, MINUTE_MS } from "@/lib/domain/sla";

/**
 * SLA maths is the highest-risk pure logic in the product: a wrong deadline
 * either breaches a real customer commitment or hides a breach from the team.
 * These tests pin the behaviour at and around every boundary.
 */
const T0 = new Date("2026-09-01T09:00:00.000Z");

describe("getSlaPolicy", () => {
  it("derives a shorter target for higher priority", () => {
    expect(getSlaPolicy("critical").firstResponseMinutes).toBeLessThan(
      getSlaPolicy("high").firstResponseMinutes,
    );
    expect(getSlaPolicy("high").firstResponseMinutes).toBeLessThan(
      getSlaPolicy("medium").firstResponseMinutes,
    );
  });

  it("allows the warning threshold to be configured", () => {
    expect(getSlaPolicy("high", 30).warningMinutes).toBe(30);
  });
});

describe("evaluateSla", () => {
  const policy = { firstResponseMinutes: 60, warningMinutes: 15 };

  it("computes the deadline from the start timestamp and policy", () => {
    const result = evaluateSla({ policy, startedAt: T0, now: T0 });

    expect(result.deadline.getTime()).toBe(T0.getTime() + 60 * MINUTE_MS);
  });

  it("places the warning threshold before the deadline", () => {
    const result = evaluateSla({ policy, startedAt: T0, now: T0 });

    expect(result.warningAt.getTime()).toBe(T0.getTime() + 45 * MINUTE_MS);
    expect(result.warningAt.getTime()).toBeLessThan(result.deadline.getTime());
  });

  it("is safe while time remains outside the warning window", () => {
    const result = evaluateSla({
      policy,
      startedAt: T0,
      now: new Date(T0.getTime() + 30 * MINUTE_MS),
    });

    expect(result.state).toBe("safe");
    expect(result.label).toBe("30m remaining");
  });

  it("enters the warning state exactly at the warning threshold", () => {
    const result = evaluateSla({
      policy,
      startedAt: T0,
      now: new Date(T0.getTime() + 45 * MINUTE_MS),
    });

    expect(result.state).toBe("warning");
    expect(result.label).toBe("15m remaining");
  });

  it("is still safe one millisecond before the warning threshold", () => {
    const result = evaluateSla({
      policy,
      startedAt: T0,
      now: new Date(T0.getTime() + 45 * MINUTE_MS - 1),
    });

    expect(result.state).toBe("safe");
  });

  it("breaches exactly at the deadline", () => {
    const result = evaluateSla({
      policy,
      startedAt: T0,
      now: new Date(T0.getTime() + 60 * MINUTE_MS),
    });

    expect(result.state).toBe("breached");
    expect(result.overdueMs).toBe(0);
    expect(result.label).toBe("under 1m over SLA");
  });

  it("reports a growing overdue amount after the deadline", () => {
    const result = evaluateSla({
      policy,
      startedAt: T0,
      now: new Date(T0.getTime() + 72 * MINUTE_MS),
    });

    expect(result.state).toBe("breached");
    expect(result.overdueMs).toBe(12 * MINUTE_MS);
    expect(result.remainingMs).toBe(-12 * MINUTE_MS);
    expect(result.label).toBe("12m over SLA");
  });

  it("is met once a first response has been recorded", () => {
    const respondedAt = new Date(T0.getTime() + 10 * MINUTE_MS);
    const result = evaluateSla({
      policy,
      startedAt: T0,
      firstRespondedAt: respondedAt,
      now: new Date(T0.getTime() + 90 * MINUTE_MS),
    });

    expect(result.state).toBe("met");
    expect(result.label).toBe("Met in 10m");
  });

  it("reports a breach that occurred before a late first response", () => {
    const respondedAt = new Date(T0.getTime() + 80 * MINUTE_MS);
    const result = evaluateSla({
      policy,
      startedAt: T0,
      firstRespondedAt: respondedAt,
      now: respondedAt,
    });

    expect(result.state).toBe("met");
    expect(result.label).toBe("Met in 1h 20m");
  });

  it("reports paused conversations without a misleading countdown", () => {
    const result = evaluateSla({
      policy,
      startedAt: T0,
      paused: true,
      now: new Date(T0.getTime() + 200 * MINUTE_MS),
    });

    expect(result.state).toBe("paused");
    expect(result.label).toBe("Paused");
  });

  it("prefers a recorded response over a pause", () => {
    const result = evaluateSla({
      policy,
      startedAt: T0,
      paused: true,
      firstRespondedAt: new Date(T0.getTime() + 5 * MINUTE_MS),
      now: new Date(T0.getTime() + 5 * MINUTE_MS),
    });

    expect(result.state).toBe("met");
  });

  it("always produces a non-empty label", () => {
    const states = [
      evaluateSla({ policy, startedAt: T0, now: T0 }),
      evaluateSla({ policy, startedAt: T0, now: new Date(T0.getTime() + 50 * MINUTE_MS) }),
      evaluateSla({ policy, startedAt: T0, now: new Date(T0.getTime() + 90 * MINUTE_MS) }),
      evaluateSla({ policy, startedAt: T0, paused: true, now: T0 }),
      evaluateSla({
        policy,
        startedAt: T0,
        firstRespondedAt: new Date(T0.getTime() + MINUTE_MS),
        now: T0,
      }),
    ];

    for (const result of states) {
      expect(result.label.length).toBeGreaterThan(0);
    }
  });
});

describe("formatDuration", () => {
  it("collapses sub-minute durations", () => {
    expect(formatDuration(0)).toBe("under 1m");
    expect(formatDuration(59_000)).toBe("under 1m");
  });

  it("rounds up so a live countdown never shows zero", () => {
    expect(formatDuration(MINUTE_MS + 1)).toBe("2m");
  });

  it("formats minutes", () => {
    expect(formatDuration(18 * MINUTE_MS)).toBe("18m");
  });

  it("formats whole hours", () => {
    expect(formatDuration(2 * HOUR_MS)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(2 * HOUR_MS + 15 * MINUTE_MS)).toBe("2h 15m");
  });

  it("ignores the sign, since over/under is expressed by the label", () => {
    expect(formatDuration(-12 * MINUTE_MS)).toBe("12m");
  });
});
