import { describe, expect, it } from "vitest";

import {
  APP_CONFIG,
  CHANNELS,
  CHANNEL_LABELS,
  DEFAULT_SLA_MINUTES,
  DEMO_CONFIG,
} from "@/lib/config";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("supports array and object conditional syntax", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  it("lets a later Tailwind utility win a conflict", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("preserves non-conflicting utilities", () => {
    expect(cn("px-2 py-1", "text-sm")).toBe("px-2 py-1 text-sm");
  });
});

describe("application configuration", () => {
  it("exposes a product name and tagline", () => {
    expect(APP_CONFIG.name).toBe("Senami");
    expect(APP_CONFIG.tagline).toBeTruthy();
  });

  it("marks the build as a demo environment with a visible label", () => {
    expect(DEMO_CONFIG.enabled).toBe(true);
    expect(DEMO_CONFIG.label).toBe("DEMO ENVIRONMENT");
  });

  it("defines the four initial mock channels with labels", () => {
    expect([...CHANNELS]).toEqual(["instagram", "facebook", "x", "tiktok"]);

    for (const channel of CHANNELS) {
      expect(CHANNEL_LABELS[channel]).toBeTruthy();
    }
  });

  it("orders SLA targets from most to least urgent", () => {
    expect(DEFAULT_SLA_MINUTES.critical).toBeLessThan(DEFAULT_SLA_MINUTES.high);
    expect(DEFAULT_SLA_MINUTES.high).toBeLessThan(DEFAULT_SLA_MINUTES.medium);
    expect(DEFAULT_SLA_MINUTES.medium).toBeLessThan(DEFAULT_SLA_MINUTES.low);
  });
});
