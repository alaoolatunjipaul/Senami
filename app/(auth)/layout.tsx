import { LifeBuoy } from "lucide-react";
import type { ReactNode } from "react";

import { APP_CONFIG, DEMO_CONFIG } from "@/lib/config";

/** Centred, brand-led canvas for the authentication screens. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-canvas flex min-h-dvh flex-col">
      <header className="border-line bg-surface flex h-14 shrink-0 items-center gap-2 border-b px-6">
        <span className="bg-primary text-primary-ink flex size-7 items-center justify-center rounded-md">
          <LifeBuoy className="size-4" aria-hidden="true" />
        </span>
        <span className="text-ink text-sm font-semibold tracking-tight">{APP_CONFIG.name}</span>
        {DEMO_CONFIG.enabled ? <span className="text-ink-subtle text-xs">· demo</span> : null}
      </header>
      <main className="flex flex-1 items-center justify-center p-6">{children}</main>
      <footer className="text-ink-subtle pb-6 text-center text-xs">{APP_CONFIG.description}</footer>
    </div>
  );
}
