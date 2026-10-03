import type { Metadata, Viewport } from "next";

import { APP_CONFIG } from "@/lib/config";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/domain/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} - ${APP_CONFIG.tagline}`,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
  robots: {
    // Senami is an internal operational tool and a demo build. Do not index.
    index: false,
    follow: false,
    nocache: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning`: the bootstrap script below sets the theme
    // class on <html> before React hydrates, so the server markup and the client
    // DOM intentionally differ on that one attribute.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Applies the stored Light/Dark/System preference before first paint.
          Inlined rather than imported so there is no flash of the wrong theme
          on navigation; see lib/domain/theme.ts.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="bg-canvas text-ink min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
