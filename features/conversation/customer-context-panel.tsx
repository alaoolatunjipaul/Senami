"use client";

import { Mail, MessageSquare, Phone, Star } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { CHANNEL_LABELS } from "@/lib/config";
import { channelLabel } from "@/lib/domain/channel-visuals";
import {
  CUSTOMER_INTERACTION_KIND_LABELS,
  CUSTOMER_ISSUE_OWNER_LABELS,
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_SEGMENT_TONES,
  customerContextSummary,
  type CustomerContextDto,
  type CustomerInteractionKind,
} from "@/lib/domain/customer";
import { CONVERSATION_STATUS_META, INTENT_META } from "@/lib/domain/taxonomy";
import { formatDate, formatRelativeTime } from "@/lib/format";

/**
 * Customer context drawer (§8).
 *
 * Everything an agent should read before replying: who they are, what is still
 * open, what happened before, and the account metadata that changes how a reply
 * should read. Read-only, deterministic, and derived from the same records the
 * inbox shows.
 */

const INTERACTION_ICONS: Record<CustomerInteractionKind, typeof Mail> = {
  message: MessageSquare,
  note: Star,
  call: Phone,
  email: Mail,
};

export interface CustomerContextPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerContextDto | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function CustomerContextPanel({
  open,
  onOpenChange,
  customer,
  loading,
  error,
  onRetry,
}: CustomerContextPanelProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Customer context"
      description={customer ? `${customer.name} · @${customer.handle}` : undefined}
      width="md"
    >
      <div className="space-y-5 px-4 py-4">
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
          <>
            <section className="flex items-start gap-3">
              <Avatar name={customer.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-ink text-sm font-semibold">{customer.name}</p>
                <p className="text-ink-muted text-xs">@{customer.handle}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={CUSTOMER_SEGMENT_TONES[customer.account.segment]}>
                    {CUSTOMER_SEGMENT_LABELS[customer.account.segment]}
                  </Badge>
                  <Badge tone={customer.account.verified ? "success" : "neutral"}>
                    {customer.account.verified ? "Verified" : "Unverified"}
                  </Badge>
                  {customer.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </section>

            <p className="text-ink-secondary text-xs">{customerContextSummary(customer)}</p>

            <section aria-labelledby="customer-account-heading">
              <h4 id="customer-account-heading" className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
                Account
              </h4>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-ink-subtle">Reference</dt>
                  <dd className="text-ink-secondary font-medium" data-numeric>
                    {customer.account.reference}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Customer since</dt>
                  <dd className="text-ink-secondary font-medium">{formatDate(customer.account.since)}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Preferred channel</dt>
                  <dd className="text-ink-secondary font-medium">
                    {CHANNEL_LABELS[customer.account.preferredChannel]}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Channels used</dt>
                  <dd className="text-ink-secondary font-medium">
                    {customer.channels.map((channel) => CHANNEL_LABELS[channel]).join(", ")}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="customer-open-issues-heading">
              <h4
                id="customer-open-issues-heading"
                className="text-ink-muted text-xs font-semibold tracking-wide uppercase"
              >
                Open issues
              </h4>
              {customer.openIssues.length === 0 ? (
                <p className="text-ink-muted mt-2 text-xs">Nothing open on this account.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {customer.openIssues.map((issue) => (
                    <li key={issue.id} className="border-line rounded-md border px-3 py-2">
                      <p className="text-ink-secondary line-clamp-2 text-xs">{issue.label}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone="warning" size="sm">
                          {CUSTOMER_ISSUE_OWNER_LABELS[issue.owner]}
                        </Badge>
                        <time
                          className="text-ink-subtle text-[11px]"
                          dateTime={issue.openedAt}
                          title={formatDate(issue.openedAt)}
                        >
                          {formatRelativeTime(issue.openedAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="customer-interactions-heading">
              <h4
                id="customer-interactions-heading"
                className="text-ink-muted text-xs font-semibold tracking-wide uppercase"
              >
                Interaction history
              </h4>
              <p className="text-ink-subtle mt-1 text-[11px]" data-numeric>
                {customer.interactionCount} interactions · first contact{" "}
                {formatDate(customer.firstInteractionAt)} · last{" "}
                {formatRelativeTime(customer.lastInteractionAt)}
              </p>
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
                          {formatRelativeTime(entry.occurredAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="customer-conversations-heading">
              <h4
                id="customer-conversations-heading"
                className="text-ink-muted text-xs font-semibold tracking-wide uppercase"
              >
                Previous conversations
              </h4>
              <ul className="mt-2 space-y-1.5">
                {customer.history.recent.map((entry) => (
                  <li key={entry.id} className="border-line border-b pb-1.5 last:border-b-0">
                    <p className="text-ink-secondary line-clamp-2 text-xs">{entry.preview}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge size="sm">{channelLabel(entry.channel)}</Badge>
                      <Badge size="sm" tone={CONVERSATION_STATUS_META[entry.status].tone}>
                        {CONVERSATION_STATUS_META[entry.status].label}
                      </Badge>
                      <span className="text-ink-subtle text-[11px]">{INTENT_META[entry.intent]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}