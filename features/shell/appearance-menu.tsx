"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  THEME_MODES,
  THEME_MODE_DESCRIPTIONS,
  THEME_MODE_LABELS,
  type ThemeMode,
} from "@/lib/domain/theme";

import { useTheme } from "./use-theme";

/**
 * Appearance control (Phase 10, section 11).
 *
 * A radio group rather than a toggle button because there are genuinely three
 * choices - Light, Dark and System - and "System" is not a synonym for either of
 * the others. The current selection is exposed to assistive technology as the
 * checked radio rather than inferred from an icon.
 *
 * Placement is the account menu, next to the role badge: appearance is a
 * personal preference, not a workspace setting, and every other role has this
 * same menu.
 */

const THEME_MODE_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function AppearanceMenuGroup() {
  const { mode, setMode } = useTheme();

  return (
    <>
      <DropdownMenuLabel className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
        Appearance
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={mode} onValueChange={(next) => setMode(next as ThemeMode)}>
        {THEME_MODES.map((candidate) => {
          const Icon = THEME_MODE_ICONS[candidate];
          return (
            <DropdownMenuRadioItem
              key={candidate}
              value={candidate}
              textValue={candidate}
              /*
               * Appearance is a live preview: the choice repaints the whole
               * workspace behind the menu. Closing on select would snap the menu
               * shut on every click, so comparing Light against Dark against
               * System would mean reopening it each time. Radix closes menu
               * items by default; preventing the default keeps the menu open so
               * the three options can be tried in place.
               */
              onSelect={(event) => event.preventDefault()}
            >
              <Icon aria-hidden="true" />
              <span className="flex-1">
                {THEME_MODE_LABELS[candidate]}
                <span className="text-ink-subtle block text-[11px] font-normal">
                  {THEME_MODE_DESCRIPTIONS[candidate]}
                </span>
              </span>
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
    </>
  );
}