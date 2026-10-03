import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Runtime verification config.
 *
 * Separate from `vitest.config.mts` because those tests are deliberately excluded
 * from the unit suite: they need a running dev server and exercise the real HTTP
 * surface (middleware, RBAC, route handlers) rather than module contracts.
 *
 * Usage:
 *   npm run dev            # in one terminal
 *   npm run test:runtime   # in another
 */
const projectRoot = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(projectRoot),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["e2e/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    pool: "threads",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});