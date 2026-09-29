import { cn } from "@/lib/utils";

/**
 * Skeleton placeholder.
 *
 * Used instead of spinners wherever the shape of the content is predictable -
 * queue rows, panels, tables. A skeleton communicates the layout of what is
 * loading, which reduces perceived latency in a dense operations tool.
 */
export interface SkeletonProps {
  className?: string;
  /** Announced to screen readers while the region loads. */
  label?: string;
}

export function Skeleton({ className, label = "Loading" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("bg-surface-sunken block animate-pulse rounded-sm", className)}
      data-testid="skeleton"
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A stack of skeleton rows shaped like inbox items. */
export function SkeletonList({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-line divide-y", className)} role="status" aria-busy="true">
      <span className="sr-only">Loading content</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
