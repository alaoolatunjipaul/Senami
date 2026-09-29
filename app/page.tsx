import { APP_CONFIG, DEMO_CONFIG } from "@/lib/config";

/**
 * Phase 1 placeholder. Phase 3 replaces this with the application shell and
 * Phase 4 routes unauthenticated users to the login screen.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-ink-muted text-xs font-semibold tracking-widest uppercase">
        {DEMO_CONFIG.label}
      </p>
      <h1 className="text-ink text-3xl font-semibold">{APP_CONFIG.name}</h1>
      <p className="text-ink-muted max-w-prose text-sm">{APP_CONFIG.description}</p>
    </main>
  );
}
