"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toast host.
 *
 * Toasts are configured with Senami's own tokens so notifications match the
 * rest of the surface language. They are reserved for transient, non-blocking
 * confirmations only: anything an agent must consciously act on belongs in the
 * page, not in a notification.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      duration={5000}
      // Sonner exposes themeable properties as CSS custom properties.
      style={
        {
          "--normal-bg": "var(--color-surface)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-line)",
          "--success-bg": "var(--color-success-subtle)",
          "--success-text": "var(--color-success)",
          "--error-bg": "var(--color-critical-subtle)",
          "--error-text": "var(--color-critical)",
        } as React.CSSProperties
      }
    />
  );
}

export { toast } from "sonner";
