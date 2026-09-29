import { AlertTriangle, Inbox, LoaderCircle, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Screen states.
 *
 * Spec section 44 requires that no screen is ever blank. These three components
 * are the sanctioned way to represent "nothing here", "something broke" and
 * "still working", and they are deliberately specific: a generic
 * "Something went wrong" with no retry is not acceptable.
 */

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Icon name key. Defaults to an inbox glyph. */
  icon?: "inbox" | "search" | "cases";
  action?: React.ReactNode;
  className?: string;
}

const EMPTY_ICONS = {
  inbox: Inbox,
  search: Inbox,
  cases: Inbox,
} as const;

export function EmptyState({
  title,
  description,
  icon = "inbox",
  action,
  className,
}: EmptyStateProps) {
  const Icon = EMPTY_ICONS[icon];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="bg-surface-muted text-ink-muted flex size-10 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-ink text-sm font-medium">{title}</p>
        {description ? <p className="text-ink-muted text-xs">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /**
   * Correlation ID shown to the user. It lets a user quote a precise reference
   * to support without exposing internals (spec section 33).
   */
  requestId?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Unable to load this content",
  description = "We couldn't reach the server. The problem has been logged.",
  requestId,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="bg-critical-subtle text-critical flex size-10 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-ink text-sm font-medium">{title}</p>
        <p className="text-ink-muted text-xs">{description}</p>
        {requestId ? (
          <p className="text-ink-subtle text-xs">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      ) : null}
    </div>
  );
}

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** Inline busy indicator for a region whose shape is not known in advance. */
export function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("text-ink-muted flex items-center justify-center gap-2 px-6 py-10", className)}
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export interface OfflineStateProps {
  /** Whether the client believes it is currently offline. */
  isOffline: boolean;
  className?: string;
}

/**
 * Connection banner. Rendered near the top of the shell, not as a blocking
 * overlay, so an agent can keep reading the queue while connectivity returns.
 */
export function OfflineBanner({ isOffline, className }: OfflineStateProps) {
  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border-warning-muted bg-warning-subtle text-warning flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs",
        className,
      )}
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      <span>Connection lost. You may not see new messages until it is restored.</span>
    </div>
  );
}
