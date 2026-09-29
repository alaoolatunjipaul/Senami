import type { Tone } from "@/lib/domain/taxonomy";

/**
 * The single mapping from a semantic tone to concrete design tokens.
 *
 * Badges, status dots, SLA indicators and table cells all read from here, so a
 * colour can never mean two different things in two different components.
 */
export const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-primary-subtle text-primary-ink border-primary-muted",
  success: "bg-success-subtle text-success border-success-muted",
  warning: "bg-warning-subtle text-warning border-warning-muted",
  critical: "bg-critical-subtle text-critical border-critical-muted",
  info: "bg-info-subtle text-info border-info-muted",
  neutral: "bg-neutral-subtle text-neutral border-neutral-muted",
  ai: "bg-ai-subtle text-ai border-ai-muted",
  public: "bg-visibility-public-subtle text-visibility-public border-visibility-public-muted",
  private: "bg-visibility-private-subtle text-visibility-private border-visibility-private-muted",
  internal:
    "bg-visibility-internal-subtle text-visibility-internal border-visibility-internal-muted",
};

/** Solid fill for dots and other marks that need the full-strength colour. */
export const TONE_DOT_CLASSES: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-critical",
  info: "bg-info",
  neutral: "bg-neutral",
  ai: "bg-ai",
  public: "bg-visibility-public",
  private: "bg-visibility-private",
  internal: "bg-visibility-internal",
};
