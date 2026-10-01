"use client";

import { UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SLAIndicator } from "@/components/ui/sla-indicator";
import { channelDotClass, channelLabel } from "@/lib/domain/channel-visuals";
import { slaEvaluationOf, type InboxConversationDto } from "@/lib/domain/inbox";
import {
  CONVERSATION_STATUS_META,
  INTENT_META,
  PRIORITY_META,
  SENTIMENT_META,
} from "@/lib/domain/taxonomy";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Inbox conversation card.
 *
 * One row of the queue: channel indicator, customer identity, message preview,
 * timestamp, and the intent / sentiment / priority / SLA / assignment / unread
 * state an agent triages on. The card is a button; selecting it is a real
 * selection owned by the view.
 */

export interface ConversationCardProps {
  item: InboxConversationDto;
  selected: boolean;
  onSelect: () => void;
  now: Date;
}

export function ConversationCard({ item, selected, onSelect, now }: ConversationCardProps) {
  const sla = slaEvaluationOf(item, now);
  const status = CONVERSATION_STATUS_META[item.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "border-line duration-fast w-full border-b px-4 py-3 text-left transition-colors",
        "focus-visible:ring-primary/40 outline-none focus-visible:ring-[3px] focus-visible:ring-inset",
        selected ? "bg-primary-subtle/60" : "bg-surface hover:bg-surface-muted",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={item.customer.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-ink min-w-0 flex-1 truncate text-[13px]",
                item.unread ? "font-semibold" : "font-medium",
              )}
            >
              {item.customer.name}
            </span>
            <span className="text-ink-subtle shrink-0 text-[11px]">
              {formatRelativeTime(item.lastMessageAt, now)}
            </span>
            {item.unread ? (
              <span
                role="status"
                aria-label="Unread"
                className="bg-primary mt-0.5 size-2 shrink-0 rounded-full"
              />
            ) : null}
          </div>

          <div className="text-ink-muted mt-0.5 flex items-center gap-1.5 text-[11px]">
            <span
              aria-hidden="true"
              className={cn("size-1.5 shrink-0 rounded-full", channelDotClass(item.channel))}
            />
            <span className="truncate">{item.customer.handle}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{channelLabel(item.channel)}</span>
          </div>

          <p className="text-ink-secondary mt-1 line-clamp-2 text-xs">{item.preview}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge tone="neutral" size="sm" srPrefix="Intent">
              {INTENT_META[item.intent]}
            </Badge>
            <Badge tone={SENTIMENT_META[item.sentiment].tone} size="sm" srPrefix="Sentiment">
              {SENTIMENT_META[item.sentiment].label}
            </Badge>
            <Badge tone={PRIORITY_META[item.priority].tone} size="sm" srPrefix="Priority">
              {PRIORITY_META[item.priority].label}
            </Badge>
            <Badge tone={status.tone} size="sm" srPrefix="Status">
              {status.label}
            </Badge>
            <SLAIndicator evaluation={sla} compact className="ml-auto" />
          </div>

          <div className="text-ink-subtle mt-1.5 flex items-center gap-1.5 text-[11px]">
            {item.assignedTo ? (
              <>
                <Avatar name={item.assignedTo.name} size="xs" />
                <span className="truncate">Assigned to {item.assignedTo.name}</span>
              </>
            ) : (
              <>
                <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Unassigned</span>
              </>
            )}
            {item.needsReview ? <span className="text-warning ml-auto">Needs review</span> : null}
          </div>
        </div>
      </div>
    </button>
  );
}