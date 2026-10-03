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
      // Sonner exposes themeable properties as CSS custom properties. These
      // point at the theme palettes in app/globals.css rather than at the
      // semantic utilities, so toasts follow the Light/Dark/System switch.
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--line)",
          "--success-bg": "var(--success-subtle)",
          "--success-text": "var(--success)",
          "--error-bg": "var(--critical-subtle)",
          "--error-text": "var(--critical)",
        } as React.CSSProperties
      }
    />
  );
}

export { toast } from "sonner";
