import { describe, expect, it } from "vitest";

import {
  DARK_CLASS,
  DARK_MEDIA_QUERY,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_MODES,
  THEME_MODE_DESCRIPTIONS,
  THEME_MODE_LABELS,
  THEME_STORAGE_KEY,
  normaliseThemeMode,
  resolveTheme,
  themeClassNames,
} from "@/lib/domain/theme";

/**
 * The appearance preference is deliberately pure so the three places that use it
 * (the pre-paint script, the provider and these tests) cannot drift apart.
 */
describe("theme domain", () => {
  it("offers exactly three modes, each labelled and described", () => {
    expect(THEME_MODES).toEqual(["light", "dark", "system"]);

    for (const mode of THEME_MODES) {
      expect(THEME_MODE_LABELS[mode]).toBeTruthy();
      expect(THEME_MODE_DESCRIPTIONS[mode]).toBeTruthy();
    }

    // Labels must be distinct, otherwise the radio group is ambiguous.
    expect(new Set(THEME_MODES.map((mode) => THEME_MODE_LABELS[mode])).size).toBe(3);
  });

  it("accepts only a known mode and treats anything else as unset", () => {
    expect(normaliseThemeMode("dark")).toBe("dark");
    expect(normaliseThemeMode("system")).toBe("system");

    // A stale or hand-edited storage value must not reach the document.
    expect(normaliseThemeMode("solarized")).toBeNull();
    expect(normaliseThemeMode("DARK")).toBeNull();
    expect(normaliseThemeMode("")).toBeNull();
    expect(normaliseThemeMode(null)).toBeNull();
    expect(normaliseThemeMode(undefined)).toBeNull();
  });

  it("resolves an explicit choice regardless of the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("resolves system to the operating system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("maps a resolved theme onto the document class", () => {
    expect(themeClassNames("dark")).toBe(DARK_CLASS);
    expect(themeClassNames("light")).toBe("");
  });
});

describe("theme bootstrap script", () => {
  it("reads the same storage key the provider writes", () => {
    expect(THEME_STORAGE_KEY).toBe("senami.theme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(DARK_MEDIA_QUERY));
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(DARK_CLASS));
  });

  /**
   * Runs the real bootstrap script against a minimal window/document.
   * The class set is returned so a test can assert what would actually be
   * painted on <html>, rather than asserting on the script's source text.
   */
  function runBootstrap(options: {
    stored?: string | null;
    systemPrefersDark?: boolean;
    storageThrows?: boolean;
  }): Set<string> {
    const classes = new Set<string>();
    const documentStub = {
      documentElement: {
        classList: {
          toggle: (name: string, force?: boolean) => {
            if (force === true) classes.add(name);
            else if (force === false) classes.delete(name);
          },
          add: (name: string) => classes.add(name),
          contains: (name: string) => classes.has(name),
        },
      },
    };
    const windowStub = {
      localStorage: options.storageThrows
        ? {
            getItem() {
              throw new Error("blocked");
            },
          }
        : { getItem: () => options.stored ?? null },
      matchMedia: (query: string) => ({
        matches: query === DARK_MEDIA_QUERY && (options.systemPrefersDark ?? false),
      }),
    };

    new Function("window", "document", THEME_BOOTSTRAP_SCRIPT)(windowStub, documentStub);
    return classes;
  }

  it("applies the stored mode and marks the document ready", () => {
    const classes = runBootstrap({ stored: "dark", systemPrefersDark: false });

    // A stored choice must beat a light system: the user asked for dark.
    expect(classes.has(DARK_CLASS)).toBe(true);
    expect(classes.has("theme-ready")).toBe(true);
  });

  it("falls back to the system preference when nothing is stored", () => {
    expect(runBootstrap({ stored: null, systemPrefersDark: true }).has(DARK_CLASS)).toBe(true);
    expect(runBootstrap({ stored: null, systemPrefersDark: false }).has(DARK_CLASS)).toBe(false);
  });

  it("ignores an unrecognised stored value and defers to the system", () => {
    // A hand-edited or stale preference must not produce an unstyled document.
    const classes = runBootstrap({ stored: "solarized", systemPrefersDark: true });
    expect(classes.has(DARK_CLASS)).toBe(true);
  });

  it("never throws when storage is unavailable", () => {
    expect(() =>
      runBootstrap({ stored: null, systemPrefersDark: false, storageThrows: true }),
    ).not.toThrow();
  });
});