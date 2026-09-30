"use client";

import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Notifications panel (§18).
 *
 * The panel and its empty/loading states are real; the feed itself arrives with
 * the notification subsystem. Unread counts are always derived from the
 * supplied items - never hard-coded.
 */

export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly href?: string;
  readonly seen: boolean;
}

export interface NotificationsPopoverProps {
  items: readonly NotificationItem[];
  /** Callable when the user asks to see everything. */
  onViewAll?: () => void;
  className?: string;
}

export function NotificationsPopover({ items, onViewAll, className }: NotificationsPopoverProps) {
  const unread = items.filter((item) => !item.seen).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className={cn("relative", className)}
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute top-1 right-1 flex size-2" aria-hidden="true">
              <span className="bg-critical absolute inline-flex h-full w-full animate-ping opacity-60" />
              <span className="bg-critical relative inline-flex size-2 rounded-full" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-line flex items-center justify-between border-b px-3 py-2.5">
          <h2 className="text-ink text-sm font-semibold">Notifications</h2>
          {unread > 0 ? <Badge tone="critical">{unread} unread</Badge> : null}
        </div>

        <div className="scrollbar-slim max-h-[22rem] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <p className="text-ink text-sm font-medium">You are all caught up</p>
              <p className="text-ink-muted text-xs">
                Escalations, SLA breaches and assignments appear here.
              </p>
            </div>
          ) : (
            <ul role="list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "border-line flex items-start gap-2.5 border-b px-3 py-2.5 last:border-0",
                    !item.seen && "bg-primary-subtle/60",
                  )}
                >
                  {!item.seen ? (
                    <span
                      className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-[13px] font-medium">{item.title}</p>
                    {item.body ? (
                      <p className="text-ink-muted mt-0.5 text-xs">{item.body}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {onViewAll ? (
          <div className="border-line border-t p-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={onViewAll}
            >
              View all
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
