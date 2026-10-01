"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { channelLabel } from "@/lib/domain/channel-visuals";
import type { CustomerHistoryDto } from "@/lib/domain/conversation";
import { CONVERSATION_STATUS_META, INTENT_META, PRIORITY_META } from "@/lib/domain/taxonomy";
import { formatDate, formatRelativeTime } from "@/lib/format";

/**
 * Customer history drawer (§8).
 *
 * The customer's identity, lifetime counts and their other conversations, so an
 * agent has context before replying. Read-only and derived from the mock store.
 */
export interface CustomerHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: CustomerHistoryDto | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  now: Date;
}

export function CustomerHistoryPanel({
  open,
  onOpenChange,
  history,
  loading,
  error,
  onRetry,
  now,
}: CustomerHistoryPanelProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Customer History"
      description={history ? history.customer.name : undefined}
      width="md"
    >
      <div className="px-4 py-4">
        {loading ? (
          <LoadingState label="Loading customer history…" />
        ) : error ? (
          <ErrorState
            title="Unable to load customer history"
            description="The customer record could not be loaded."
            onRetry={onRetry}
          />
        ) : !history ? (
          <p className="text-ink-muted text-xs">No customer history is available.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={history.customer.name} size="lg" />
              <div className="min-w-0">
                <p className="text-ink truncate text-sm font-semibold">{history.customer.name}</p>
                <p className="text-ink-muted truncate text-xs">{history.customer.handle}</p>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Conversations" value={history.totalConversations} />
              <Stat label="Open" value={history.openConversations} />
              <Stat label="Resolved" value={history.resolvedConversations} />
            </dl>

            <div className="text-ink-muted grid grid-cols-2 gap-3 text-xs">
              <p>
                First contact
                <span className="text-ink-secondary mt-0.5 block">{formatDate(history.firstContactAt)}</span>
              </p>
              <p>
                Last contact
                <span className="text-ink-secondary mt-0.5 block">
                  {formatRelativeTime(history.lastContactAt, now)}
                </span>
              </p>
            </div>

            <div>
              <h3 className="text-ink-secondary mb-2 text-xs font-semibold">
                Conversation History
              </h3>
              <ul className="space-y-2">
                {history.recent.map((conversation) => {
                  const status = CONVERSATION_STATUS_META[conversation.status];
                  const priority = PRIORITY_META[conversation.priority];
                  return (
                    <li key={conversation.id} className="border-line rounded-md border px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone={status.tone} size="sm" srPrefix="Status">
                          {status.label}
                        </Badge>
                        <Badge tone="neutral" size="sm" srPrefix="Intent">
                          {INTENT_META[conversation.intent]}
                        </Badge>
                        <Badge tone={priority.tone} size="sm" srPrefix="Priority">
                          {priority.label}
                        </Badge>
                        <span className="text-ink-subtle ml-auto text-[11px]">
                          {channelLabel(conversation.channel)} ·{" "}
                          {formatRelativeTime(conversation.lastMessageAt, now)}
                        </span>
                      </div>
                      <p className="text-ink-secondary mt-1 line-clamp-2 text-xs">
                        {conversation.preview}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-line rounded-md border px-3 py-2">
      <dt className="text-ink-subtle text-[11px] font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-ink mt-0.5 text-lg font-semibold" data-numeric>
        {value}
      </dd>
    </div>
  );
}
