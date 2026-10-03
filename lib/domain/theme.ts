/**
 * Appearance preference (Phase 10, sections 8-11 and 41).
 *
 * This module owns three things and nothing else:
 *   1. the vocabulary of appearance modes,
 *   2. how a preference becomes a concrete theme,
 *   3. the tiny script that applies the theme before first paint.
 *
 * It is deliberately free of React and of the DOM so the same rules can be
 * exercised in unit tests, reused by the client provider, and inlined into the
 * document head without importing anything.
 */

/** What the user chose. `system` defers to the operating system. */
export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** The theme actually painted, after `system` has been resolved. */
export const RESOLVED_THEMES = ["light", "dark"] as const;
export type ResolvedTheme = (typeof RESOLVED_THEMES)[number];

/** Local storage key. Versioned so a future token migration can invalidate it. */
export const THEME_STORAGE_KEY = "senami.theme";

/** Matches the media query the bootstrap script and the provider both rely on. */
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/** Class toggled on <html>; the whole token set is keyed off it. */
export const DARK_CLASS = "dark";

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export const THEME_MODE_DESCRIPTIONS: Record<ThemeMode, string> = {
  light: "Always the light theme",
  dark: "Always the dark theme",
  system: "Match this device's appearance setting",
};

/** Accept only a known mode; anything else means "no stored preference". */
export function normaliseThemeMode(value: string | null | undefined): ThemeMode | null {
  if (value === null || value === undefined || value === "") return null;
  return (THEME_MODES as readonly string[]).includes(value) ? (value as ThemeMode) : null;
}

/**
 * Collapse a preference into the theme to paint.
 *
 * `system` follows `prefersDark`, and an absent system answer (older browsers,
 * jsdom) falls back to light rather than guessing.
 */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return prefersDark ? "dark" : "light";
}

/** The class list <html> needs for a resolved theme. */
export function themeClassNames(theme: ResolvedTheme): string {
  return theme === "dark" ? DARK_CLASS : "";
}

/**
 * Applies the stored preference before the first paint.
 *
 * Inlined into <head> deliberately: waiting for React would flash the wrong
 * theme on every navigation, which in a workspace people sit in all day reads
 * as a bug. Written as an IIFE with no imports so it stays a few hundred bytes
 * and can fail silently - a blocked storage API must never break the page.
 */
export const THEME_BOOTSTRAP_SCRIPT = [
  "(function(){try{",
  `var k=${JSON.stringify(THEME_STORAGE_KEY)};`,
  `var m=${JSON.stringify(THEME_MODES)};`,
  "var s=null;",
  "try{s=window.localStorage.getItem(k)}catch(e){}",
  "if(m.indexOf(s)<0){s=window.matchMedia&&window.matchMedia(",
  JSON.stringify(DARK_MEDIA_QUERY),
  ").matches?",
  JSON.stringify("dark"),
  ":",
  JSON.stringify("system"),
  "}",
  "var d=s===",
  JSON.stringify("dark"),
  "||(s===",
  JSON.stringify("system"),
  "&&window.matchMedia&&window.matchMedia(",
  JSON.stringify(DARK_MEDIA_QUERY),
  ").matches);",
  `var e=document.documentElement;`,
  `e.classList.toggle(${JSON.stringify(DARK_CLASS)},d);`,
  `e.classList.add("theme-ready");`,
  "}catch(e){}})();",
].join("");