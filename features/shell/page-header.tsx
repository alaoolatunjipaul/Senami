import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Standard page header. Every routed page in the workspace begins with one so
 * page titles, descriptions and actions render consistently across phases.
 */
export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional leading piece such as a channel avatar or an icon. */
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, leading, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "border-line bg-surface flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <h1 className="text-ink truncate text-base font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-ink-muted mt-0.5 truncate text-xs">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
