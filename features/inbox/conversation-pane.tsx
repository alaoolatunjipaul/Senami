"use client";

import { CheckCheck, MailOpen } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { SLAIndicator } from "@/components/ui/sla-indicator";
import { channelLabel } from "@/lib/domain/channel-visuals";
import { slaEvaluationOf, type InboxConversationDto } from "@/lib/domain/inbox";
import {
  CONVERSATION_STATUS_META,
  INTENT_META,
  PRIORITY_META,
  SENTIMENT_META,
} from "@/lib/domain/taxonomy";
import { formatDateTime } from "@/lib/format";

/**
 * Inbox detail pane.
 *
 * Shows the selected conversation's summary and supports the one mutation the
 * inbox owns in this phase: read/unread. The timeline, replies and internal
 * notes are the conversation workspace (next phase) and are called out as such
 * rather than mocked.
 */

export interface ConversationPaneProps {
  item: InboxConversationDto | null;
  now: Date;
  onSetRead: (read: boolean) => void;
  updating: boolean;
}

export function ConversationPane({ item, now, onSetRead, updating }: ConversationPaneProps) {
  if (!item) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          title="No conversation selected"
          description="Choose a conversation from the list to see its details, or search for a customer."
        />
      </div>
    );
  }

  const sla = slaEvaluationOf(item, now);
  const status = CONVERSATION_STATUS_META[item.status];
  const sentiment = SENTIMENT_META[item.sentiment];
  const priority = PRIORITY_META[item.priority];

  return (
    <article className="flex h-full flex-col">
      <header className="border-line bg-surface flex items-start gap-3 border-b px-5 py-4">
        <Avatar name={item.customer.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-ink truncate text-sm font-semibold">{item.customer.name}</h2>
          <p className="text-ink-muted mt-0.5 text-xs">
            {item.customer.handle} · {channelLabel(item.channel)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge tone={status.tone} size="sm" srPrefix="Status">
              {status.label}
            </Badge>
            <Badge tone="neutral" size="sm" srPrefix="Intent">
              {INTENT_META[item.intent]}
            </Badge>
            <Badge tone={sentiment.tone} size="sm" srPrefix="Sentiment">
              {sentiment.label}
            </Badge>
            <Badge tone={priority.tone} size="sm" srPrefix="Priority">
              {priority.label}
            </Badge>
            {item.unread ? (
              <Badge tone="primary" size="sm" srPrefix="Read state">
                Unread
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={updating}
          onClick={() => onSetRead(item.unread)}
        >
          {item.unread ? (
            <>
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark read
            </>
          ) : (
            <>
              <MailOpen className="size-3.5" aria-hidden="true" />
              Mark unread
            </>
          )}
        </Button>
      </header>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <SLAIndicator evaluation={sla} className="text-xs" />

        <blockquote className="border-line bg-canvas text-ink-secondary mt-4 rounded-md border px-4 py-3 text-sm">
          {item.preview}
        </blockquote>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <Detail label="First response deadline" value={formatDateTime(sla.deadline)} />
          <Detail
            label="First response"
            value={item.respondedAt ? formatDateTime(item.respondedAt) : "Awaiting first response"}
          />
          <Detail label="Received" value={formatDateTime(item.receivedAt)} />
          <Detail label="Last message" value={formatDateTime(item.lastMessageAt)} />
          <Detail
            label="Assignment"
            value={
              item.assignedTo
                ? `${item.assignedTo.name} · ${item.assignedTo.teamName}`
                : "Unassigned"
            }
          />
          <Detail label="Needs review" value={item.needsReview ? "Yes" : "No"} />
          <Detail label="Conversation ID" value={item.id} mono />
        </dl>

        <p className="border-line text-ink-subtle mt-8 border-t pt-4 text-xs leading-relaxed">
          The conversation timeline, public/private reply controls, internal notes, cases and AI
          assistance arrive with the conversation workspace in the next phase.
        </p>
      </div>
    </article>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-ink-subtle text-[11px] font-medium tracking-wide uppercase">{label}</dt>
      <dd className={`text-ink-secondary mt-0.5 text-sm${mono ? " font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}