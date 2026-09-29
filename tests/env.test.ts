import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getIntegrationMode, getServerEnv, resetServerEnvCache } from "@/lib/env";

/**
 * Environment configuration is the first thing that can compromise a deployment,
 * so these tests pin the fail-closed behaviour: invalid configuration must stop
 * the process, and errors must never echo secret values.
 */
const CLEARED_KEYS = [
  "DATABASE_URL",
  "REDIS_URL",
  "SESSION_SECRET",
  "SESSION_TTL_SECONDS",
  "AI_PROVIDER",
  "AI_API_KEY",
  "LOG_LEVEL",
] as const;

describe("server environment configuration", () => {
  beforeEach(() => {
    resetServerEnvCache();
    vi.stubEnv("NODE_ENV", "test");
    for (const key of CLEARED_KEYS) {
      vi.stubEnv(key, undefined);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("applies safe defaults when nothing is configured", () => {
    const env = getServerEnv();

    expect(env.AI_PROVIDER).toBe("mock");
    expect(env.SESSION_TTL_SECONDS).toBe(28_800);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("caches the parsed result so validation runs once", () => {
    const first = getServerEnv();
    const second = getServerEnv();

    expect(second).toBe(first);
  });

  it("coerces a numeric session TTL from a string", () => {
    vi.stubEnv("SESSION_TTL_SECONDS", "3600");

    expect(getServerEnv().SESSION_TTL_SECONDS).toBe(3_600);
  });

  it("rejects a non-numeric session TTL", () => {
    vi.stubEnv("SESSION_TTL_SECONDS", "not-a-number");

    expect(() => getServerEnv()).toThrow(/SESSION_TTL_SECONDS/);
  });

  it("rejects an unknown AI provider", () => {
    vi.stubEnv("AI_PROVIDER", "openai");

    expect(() => getServerEnv()).toThrow(/AI_PROVIDER/);
  });

  it("refuses to start in production without a session secret", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getServerEnv()).toThrow(/SESSION_SECRET/);
  });

  it("refuses a session secret shorter than 32 characters in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "too-short");

    expect(() => getServerEnv()).toThrow(/SESSION_SECRET/);
  });

  it("starts in production with a sufficiently long session secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a".repeat(43));

    expect(getServerEnv().SESSION_SECRET).toHaveLength(43);
  });

  it("requires an AI API key only when a production provider is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a".repeat(43));
    vi.stubEnv("AI_PROVIDER", "production");

    expect(() => getServerEnv()).toThrow(/AI_API_KEY/);
  });

  it("never echoes the offending value in a validation error", () => {
    vi.stubEnv("NODE_ENV", "production");
    // Shorter than the 32-character minimum, so validation must reject it.
    const rejectedValue = "leaky-short-secret-value";
    vi.stubEnv("SESSION_SECRET", rejectedValue);

    let message = "";
    try {
      getServerEnv();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("SESSION_SECRET");
    expect(message).not.toContain(rejectedValue);
  });

  describe("integration mode", () => {
    it("reports mock mode by default", () => {
      expect(getIntegrationMode()).toBe("mock");
    });

    it("reports production mode only when a production provider is configured", () => {
      vi.stubEnv("AI_PROVIDER", "production");
      vi.stubEnv("AI_API_KEY", "server-side-only");

      expect(getIntegrationMode()).toBe("production");
    });
  });
});
