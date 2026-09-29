import { cn } from "@/lib/utils";

import { TONE_DOT_CLASSES } from "./tone";
import type { Tone } from "@/lib/domain/taxonomy";

/**
 * Status indicator.
 *
 * A coloured dot is never sufficient on its own (WCAG 1.4.1). This component
 * therefore always pairs the dot with a visible text label, and accepts an
 * `srLabel` for contexts where the visible label is abbreviated.
 */
export interface StatusIndicatorProps {
  tone: Tone;
  label: string;
  /** Full text for screen readers when `label` is abbreviated. */
  srLabel?: string;
  size?: "sm" | "md";
  className?: string;
}

const DOT_SIZES = {
  sm: "size-1.5",
  md: "size-2",
} as const;

export function StatusIndicator({
  tone,
  label,
  srLabel,
  size = "md",
  className,
}: StatusIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden="true"
        className={cn("shrink-0 rounded-full", DOT_SIZES[size], TONE_DOT_CLASSES[tone])}
      />
      <span className={cn("truncate text-xs", srLabel ? "sr-only" : "text-ink-secondary")}>
        {srLabel ?? label}
      </span>
    </span>
  );
}
