import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * The file is `.mts` so Vite loads it as native ESM (the package is CommonJS, so
 * a `.ts` config with ESM syntax produces a loader warning).
 *
 * The `threads` pool is used deliberately: it starts faster and is more
 * reliable than `forks` on Windows, which matters because the test suite is run
 * on every save and in CI.
 */
const projectRoot = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    pool: "threads",
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "features/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "server/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.d.ts", "**/index.ts", "**/*.config.{ts,mts}"],
    },
  },
});
