"use client";

import { ArrowUpRight, Mail, MessageSquare, Phone, Star } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { CHANNEL_LABELS } from "@/lib/config";
import { channelDotClass, channelLabel } from "@/lib/domain/channel-visuals";
import {
  CUSTOMER_INTERACTION_KIND_LABELS,
  CUSTOMER_ISSUE_OWNER_LABELS,
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_SEGMENT_TONES,
  type CustomerContextDto,
  type CustomerInteractionKind,
} from "@/lib/domain/customer";
import { CONVERSATION_STATUS_META } from "@/lib/domain/taxonomy";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Customer context (Response Desk right column).
 *
 * The facts an agent needs before replying: who they are, what is still open,
 * and what happened before. It renders as a full-height column when it owns the
 * space next to the conversation, and as the body of the customer-context drawer
 * when it does not - the customer context must never permanently claim width, so
 * the conversation keeps the dominant column and this surface opens over it on
 * demand. Every previous interaction is a real link back into the workspace.
 */

const INTERACTION_ICONS: Record<CustomerInteractionKind, typeof Mail> = {
  message: MessageSquare,
  note: Star,
  call: Phone,
  email: Mail,
};

export interface CustomerContextPaneProps {
  customer: CustomerContextDto | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Internal conversation id of the interaction currently open. */
  activeConversationId: string | null;
  /** Open a previous interaction in the workspace. */
  onOpenInteraction: (conversationId: string) => void;
  /** Open the full customer history drawer. */
  onOpenFullHistory?: () => void;
  now: Date;
  /**
   * Extra classes for the outer surface. The drawer passes a full-width,
   * border-less variant; omitting it keeps the standalone column.
   */
  className?: string;
  /** Hide the column's own heading when a surrounding surface already titles it. */
  hideHeading?: boolean;
}

export function CustomerContextPane({
  customer,
  loading,
  error,
  onRetry,
  activeConversationId,
  onOpenInteraction,
  onOpenFullHistory,
  now,
  className,
  hideHeading = false,
}: CustomerContextPaneProps) {
  return (
    <aside
      aria-label="Customer context and interaction history"
      className={cn(
        "bg-surface flex min-h-0 shrink-0 flex-col",
        className ?? "border-line w-[18rem] border-l lg:w-[20rem] xl:w-[22rem]",
      )}
    >
      {hideHeading ? null : (
        <div className="border-line flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-ink text-xs font-semibold">Customer context</h2>
            <p className="text-ink-subtle text-[11px]">
              Read alongside the conversation while you reply.
            </p>
          </div>
          {onOpenFullHistory ? (
            <button
              type="button"
              onClick={onOpenFullHistory}
              className="border-line text-ink-secondary hover:bg-surface-muted hover:text-ink shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium"
            >
              Full history
            </button>
          ) : null}
        </div>
      )}

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <LoadingState label="Loading customer context…" />
        ) : error ? (
          <ErrorState
            title="Unable to load customer context"
            description="The customer record could not be loaded. The conversation is unaffected."
            onRetry={onRetry}
          />
        ) : !customer ? (
          <p className="text-ink-muted text-xs">No customer context is available.</p>
        ) : (
          <div className="space-y-5">
            <section className="flex items-start gap-3">
              <Avatar name={customer.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate text-sm font-semibold">{customer.name}</p>
                <p className="text-ink-muted truncate text-xs">@{customer.handle}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <Badge tone={CUSTOMER_SEGMENT_TONES[customer.account.segment]} size="sm">
                    {CUSTOMER_SEGMENT_LABELS[customer.account.segment]}
                  </Badge>
                  <Badge
                    tone={customer.account.verified ? "success" : "neutral"}
                    size="sm"
                  >
                    {customer.account.verified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
              </div>
            </section>

            <dl className="grid grid-cols-3 gap-2" data-numeric>
              <Stat label="Total" value={customer.history.totalConversations} />
              <Stat label="Open" value={customer.history.openConversations} />
              <Stat label="Resolved" value={customer.history.resolvedConversations} />
            </dl>

            <section aria-labelledby="pane-account-heading">
              <h3
                id="pane-account-heading"
                className="text-ink-muted text-[11px] font-semibold tracking-wide uppercase"
              >
                Account
              </h3>
              <dl className="mt-2 space-y-1.5 text-xs">
                <Row label="Reference" value={customer.account.reference} />
                <Row label="Customer since" value={formatDate(customer.account.since)} />
                <Row
                  label="Preferred channel"
                  value={CHANNEL_LABELS[customer.account.preferredChannel]}
                />
                <Row
                  label="Channels used"
                  value={customer.channels.map((channel) => CHANNEL_LABELS[channel]).join(", ")}
                />
              </dl>
            </section>

            {customer.openIssues.length > 0 ? (
              <section aria-labelledby="pane-open-issues-heading">
                <h3
                  id="pane-open-issues-heading"
                  className="text-ink-muted text-[11px] font-semibold tracking-wide uppercase"
                >
                  Open issues
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {customer.openIssues.map((issue) => (
                    <li key={issue.id} className="py-0.5">
                      <p className="text-ink-secondary text-xs">{issue.label}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-warning text-[11px] font-medium">
                          {CUSTOMER_ISSUE_OWNER_LABELS[issue.owner]}
                        </span>
                        <time
                          className="text-ink-subtle text-[11px]"
                          dateTime={issue.openedAt}
                          title={formatDateTime(issue.openedAt)}
                        >
                          {formatRelativeTime(issue.openedAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="pane-interactions-heading">
              <h3
                id="pane-interactions-heading"
                className="text-ink-muted text-[11px] font-semibold tracking-wide uppercase"
              >
                Interaction history
              </h3>
              <p className="text-ink-subtle mt-1 text-[11px]" data-numeric>
                {customer.history.totalConversations} interactions · first contact{" "}
                {formatDate(customer.history.firstContactAt)} · last{" "}
                {formatRelativeTime(customer.history.lastContactAt, now)}
              </p>

              <ul className="mt-2 space-y-1.5">
                {customer.history.recent.map((entry) => {
                  const active = entry.id === activeConversationId;
                  const status = CONVERSATION_STATUS_META[entry.status];
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onOpenInteraction(entry.id)}
                        aria-current={active ? "true" : undefined}
                        className={
                          active
                            ? "bg-primary-subtle/60 w-full px-1.5 py-1.5 text-left"
                            : "hover:bg-surface-muted w-full px-1.5 py-1.5 text-left transition-colors"
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className={`size-1.5 shrink-0 rounded-full ${channelDotClass(entry.channel)}`}
                          />
                          <span className="text-ink-secondary truncate text-[11px]">
                            {channelLabel(entry.channel)}
                          </span>
                          <span className="text-ink-subtle text-[11px]">
                            {formatRelativeTime(entry.receivedAt, now)}
                          </span>
                          <ArrowUpRight
                            className="text-ink-subtle ml-auto size-3 shrink-0"
                            aria-hidden="true"
                          />
                        </div>

                        <p
                          className="text-ink-secondary mt-1 inline-block font-mono text-[10px]"
                          data-numeric
                        >
                          {entry.interactionId}
                        </p>

                        <p className="text-ink-secondary mt-1 line-clamp-2 text-xs">
                          {entry.preview}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone={status.tone} size="sm" srPrefix="Status">
                            {status.label}
                          </Badge>
                          <span className="text-ink-subtle text-[11px]">
                            {entry.assignedTo ? entry.assignedTo.name : "Unassigned"}
                          </span>
                          <time
                            className="text-ink-subtle ml-auto text-[11px]"
                            dateTime={entry.receivedAt}
                            title={formatDateTime(entry.receivedAt)}
                          >
                            {formatDate(entry.receivedAt)}
                          </time>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="pane-timeline-heading">
              <h3
                id="pane-timeline-heading"
                className="text-ink-muted text-[11px] font-semibold tracking-wide uppercase"
              >
                Touchpoints
              </h3>
              <ul className="mt-2 space-y-1.5">
                {customer.recentInteractions.map((entry) => {
                  const Icon = INTERACTION_ICONS[entry.kind];
                  return (
                    <li key={entry.id} className="flex items-start gap-2">
                      <Icon className="text-ink-muted mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-ink-secondary line-clamp-2 text-xs">{entry.summary}</p>
                        <p className="text-ink-subtle text-[11px]">
                          {CUSTOMER_INTERACTION_KIND_LABELS[entry.kind]} ·{" "}
                          {formatRelativeTime(entry.occurredAt, now)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-line rounded-md border px-2 py-1.5">
      <dt className="text-ink-subtle text-[10px] font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-ink mt-0.5 text-sm font-semibold" data-numeric>
        {value}
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-subtle shrink-0">{label}</dt>
      <dd className="text-ink-secondary truncate text-right font-medium">{value}</dd>
    </div>
  );
}