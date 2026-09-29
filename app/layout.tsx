import type { Metadata, Viewport } from "next";

import { APP_CONFIG } from "@/lib/config";

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
    <html lang="en">
      <body className="bg-canvas text-ink min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
