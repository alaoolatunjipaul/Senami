"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  DARK_CLASS,
  DARK_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  normaliseThemeMode,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/domain/theme";

/**
 * Appearance state for the whole application.
 *
 * The preference lives outside React - in localStorage, with the operating
 * system as the fallback signal - so it is read through `useSyncExternalStore`
 * rather than mirrored into state. That matters for three reasons:
 *   - the document is already themed by the inline bootstrap script before any
 *     component renders, so there is nothing to repaint and no flash,
 *   - a system appearance change arrives through the same subscription, so a
 *     user who flips their device mid-shift is not stuck on a stale theme,
 *   - nothing sets state inside an effect, so there is no cascading render.
 *
 * The store is module-level because appearance is a per-browser preference, not
 * per-session or per-component: two roots on one page must agree on the theme.
 */

/** Sentinel broadcast to subscribers when this tab changes the preference. */
const CHANGE_EVENT = "senami:theme-change";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function readMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = normaliseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
    if (stored !== null) return stored;
  } catch {
    // Private mode or a blocked storage API: fall through to what is painted.
  }
  // Nothing stored: the bootstrap script already resolved light or dark from the
  // system, so adopt its answer rather than losing it.
  return document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light";
}

function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle(DARK_CLASS, theme === "dark");
}

/** Subscribe to changes from this tab, the operating system and other tabs. */
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  // `storage` fires in *other* tabs, which is what keeps two open windows in step.
  window.addEventListener("storage", onChange);
  const query =
    typeof window.matchMedia === "function" ? window.matchMedia(DARK_MEDIA_QUERY) : null;
  query?.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    query?.removeEventListener("change", onChange);
  };
}

/*
 * Server and first-render values. `useSyncExternalStore` renders these during SSR
 * and hydration, then swaps to the real client snapshot once mounted - so the
 * hydrated markup matches and there is no mismatch warning on a stored theme.
 */
function serverMode(): ThemeMode {
  return "system";
}

function serverTheme(): ResolvedTheme {
  return "light";
}

export interface AppearanceState {
  /** What the user chose. */
  readonly mode: ThemeMode;
  /** What is actually painted right now. */
  readonly theme: ResolvedTheme;
  readonly setMode: (mode: ThemeMode) => void;
}

export function useTheme(): AppearanceState {
  const mode = useSyncExternalStore(subscribe, readMode, serverMode);
  const theme = useSyncExternalStore<ResolvedTheme>(
    subscribe,
    () => resolveTheme(readMode(), systemPrefersDark()),
    serverTheme,
  );

  const setMode = useCallback((next: ThemeMode) => {
    applyTheme(resolveTheme(next, systemPrefersDark()));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The theme still applies for this session; it just will not persist.
    }
    notify();
  }, []);

  return useMemo<AppearanceState>(() => ({ mode, theme, setMode }), [mode, theme, setMode]);
}