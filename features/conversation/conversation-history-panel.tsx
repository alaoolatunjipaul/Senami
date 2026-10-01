"use client";

import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { AUDIT_EVENT_META, type AuditEventDto } from "@/lib/domain/conversation";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

/**
 * Conversation history drawer (§8).
 *
 * The append-only audit trail: creation, replies, internal notes, AI
 * suggestions, assignment changes, escalations and public-to-private moves.
 * This is the record that makes internal activity accountable.
 */
export interface ConversationHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: readonly AuditEventDto[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  now: Date;
}

export function ConversationHistoryPanel({
  open,
  onOpenChange,
  events,
  loading,
  error,
  onRetry,
  now,
}: ConversationHistoryPanelProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Conversation History"
      description="Every action taken on this conversation."
      width="md"
    >
      <div className="px-4 py-4">
        {loading ? (
          <LoadingState label="Loading conversation history…" />
        ) : error ? (
          <ErrorState
            title="Unable to load conversation history"
            description="The audit trail could not be loaded."
            onRetry={onRetry}
          />
        ) : events.length === 0 ? (
          <EmptyState title="Nothing recorded yet" description="Actions on this conversation will appear here." />
        ) : (
          <ol className="space-y-3" aria-label="Audit trail">
            {events.map((event) => {
              const meta = AUDIT_EVENT_META[event.type];
              return (
                <li key={event.id} className="border-line flex gap-3 border-l-2 pl-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={meta.tone} size="sm" srPrefix="Event">
                        {meta.label}
                      </Badge>
                      <span className="text-ink-secondary truncate text-xs">{event.actor}</span>
                    </div>
                    <p className="text-ink-secondary mt-1 text-xs">{event.summary}</p>
                  </div>
                  <time
                    dateTime={event.createdAt}
                    title={formatDateTime(event.createdAt)}
                    className="text-ink-subtle shrink-0 text-[11px]"
                  >
                    {formatRelativeTime(event.createdAt, now)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Drawer>
  );
}
