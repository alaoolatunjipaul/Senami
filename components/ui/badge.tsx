import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import type { Tone } from "@/lib/domain/taxonomy";
import { cn } from "@/lib/utils";

import { TONE_CLASSES } from "./tone";

/**
 * Badge.
 *
 * A compact, non-interactive label for a status, priority, sentiment, channel
 * or message visibility. Badges are never clickable - if a badge needs to be
 * activated it should be a Button or a DropdownMenu trigger, which carry
 * proper keyboard and focus semantics.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        primary: TONE_CLASSES.primary,
        success: TONE_CLASSES.success,
        warning: TONE_CLASSES.warning,
        critical: TONE_CLASSES.critical,
        info: TONE_CLASSES.info,
        neutral: TONE_CLASSES.neutral,
        ai: TONE_CLASSES.ai,
        public: TONE_CLASSES.public,
        private: TONE_CLASSES.private,
        internal: TONE_CLASSES.internal,
      },
      size: {
        sm: "h-5 px-1.5 text-[11px] leading-none",
        md: "h-6 px-2 text-xs leading-none",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children">, VariantProps<typeof badgeVariants> {
  children?: React.ReactNode;
  tone?: Tone;
  /** Visually hidden text announced to screen readers, e.g. "Priority: High". */
  srPrefix?: string;
}

export function Badge({ className, tone, size, srPrefix, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {srPrefix ? <span className="sr-only">{srPrefix}: </span> : null}
      {children}
    </span>
  );
}
