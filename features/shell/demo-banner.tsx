import { APP_CONFIG, DEMO_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * The demo environment strip (§5, §47).
 *
 * Senami ships in a demonstration mode where every social account, message and
 * AI response is synthetic. That mode is surfaced at the top of the shell so
 * it can never be mistaken for a production integration. When a real
 * integration is configured this strip disappears.
 */
export function DemoBanner({ className }: { className?: string }) {
  if (!DEMO_CONFIG.enabled) return null;

  return (
    <div
      role="note"
      className={cn(
        "border-warning-muted bg-warning-subtle text-warning flex h-7 shrink-0 items-center justify-center gap-2 border-b px-4 text-[11px] font-medium",
        className,
      )}
    >
      <span aria-hidden="true" className="relative flex size-1.5">
        <span className="bg-warning absolute inline-flex h-full w-full animate-ping opacity-60" />
        <span className="bg-warning relative inline-flex size-1.5 rounded-full" />
      </span>
      <span className="font-semibold tracking-wider uppercase">{DEMO_CONFIG.label}</span>
      <span aria-hidden="true" className="text-warning-muted">
        ·
      </span>
      <span>{DEMO_CONFIG.description}</span>
      <span aria-hidden="true" className="text-warning-muted">
        ·
      </span>
      <span>{APP_CONFIG.name}</span>
      <span className="sr-only">{DEMO_CONFIG.description}</span>
    </div>
  );
}
