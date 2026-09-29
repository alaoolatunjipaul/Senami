import { z } from "zod";

/**
 * Validated server environment configuration.
 *
 * Rules (spec sections 41, 50, 55):
 *  - Values are validated once, at first access, and cached.
 *  - Validation errors report *keys and rules only*. Values are never logged.
 *  - Production refuses to boot with missing security-critical configuration.
 *  - This module must only ever be imported from server code.
 */
const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1).optional(),
    SESSION_SECRET: z.string().min(32).optional(),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28_800),
    AI_PROVIDER: z.enum(["mock", "production"]).default("mock"),
    AI_API_KEY: z.string().min(1).optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    if (!env.SESSION_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["SESSION_SECRET"],
        message:
          "SESSION_SECRET is required in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
      });
    }

    if (env.AI_PROVIDER === "production" && !env.AI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_API_KEY"],
        message: "AI_API_KEY is required when AI_PROVIDER=production.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "(root)";
      return `  - ${key}: ${issue.message}`;
    })
    .join("\n");
}

/**
 * Parse and cache the server environment. Throws on invalid configuration so
 * that misconfiguration fails fast at startup rather than at first request.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    SESSION_TTL_SECONDS: process.env.SESSION_TTL_SECONDS,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_API_KEY: process.env.AI_API_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });

  if (!parsed.success) {
    // Only keys and rules are surfaced - never the offending values.
    throw new Error(`Invalid Senami environment configuration:\n${formatIssues(parsed.error)}`);
  }

  cached = parsed.data;
  return cached;
}

/** True when the process is running in production mode. */
export function isProduction(): boolean {
  return getServerEnv().NODE_ENV === "production";
}

/**
 * The integration mode of this deployment. Senami ships with deterministic
 * mock providers so the demo runs without any real social credentials.
 */
export function getIntegrationMode(): "mock" | "production" {
  return getServerEnv().AI_PROVIDER === "production" ? "production" : "mock";
}

/** Test-only helper to clear the parsed cache between test cases. */
export function resetServerEnvCache(): void {
  cached = null;
}
