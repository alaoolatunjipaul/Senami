"use client";

import {
  CheckCheck,
  CheckCircle2,
  History,
  Lock,
  MailOpen,
  ShieldAlert,
  Sparkles,
  StickyNote,
  UserPlus,
  UserRound,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SLAIndicator } from "@/components/ui/sla-indicator";
import { channelLabel } from "@/lib/domain/channel-visuals";
import { slaEvaluationOf, type InboxConversationDto } from "@/lib/domain/inbox";
import {
  CONVERSATION_STATUS_META,
  INTENT_META,
  PRIORITY_META,
  SENTIMENT_META,
} from "@/lib/domain/taxonomy";

/**
 * Conversation header (§8).
 *
 * Identity, channel, conversation id and the full triage snapshot (intent,
 * sentiment, priority, status, SLA). The SLA countdown is computed from the real
 * timestamps and the live clock, never hard-coded. The action row exposes the
 * customer/conversation history, assignment, escalation and the public-to-private
 * move; every action is authorised again on the server.
 */
export interface ConversationHeaderProps {
  conversation: InboxConversationDto;
  now: Date;
  unread: boolean;
  updatingRead: boolean;
  canReply: boolean;
  canEscalate: boolean;
  canAssign: boolean;
  canMoveToPrivate: boolean;
  /** Phase 8: AI drafting assistance. */
  canUseAi: boolean;
  /** Phase 8: resolving or reopening the conversation. */
  canResolve: boolean;
  onSetRead: (read: boolean) => void;
  onShowCustomerHistory: () => void;
  onShowConversationHistory: () => void;
  onAssign: () => void;
  onEscalate: () => void;
  onMoveToPrivate: () => void;
  onAddNote: () => void;
  onShowAiAssist: () => void;
  onShowResolve: () => void;
}

export function ConversationHeader({
  conversation,
  now,
  unread,
  updatingRead,
  canReply,
  canEscalate,
  canAssign,
  canMoveToPrivate,
  canUseAi,
  canResolve,
  onSetRead,
  onShowCustomerHistory,
  onShowConversationHistory,
  onAssign,
  onEscalate,
  onMoveToPrivate,
  onAddNote,
  onShowAiAssist,
  onShowResolve,
}: ConversationHeaderProps) {
  const sla = slaEvaluationOf(conversation, now);
  const status = CONVERSATION_STATUS_META[conversation.status];
  const sentiment = SENTIMENT_META[conversation.sentiment];
  const priority = PRIORITY_META[conversation.priority];
  const isResolved = conversation.status === "resolved" || conversation.status === "closed";

  return (
    <header className="border-line bg-surface shrink-0 border-b">
      <div className="flex items-start gap-3 px-5 py-4">
        <Avatar name={conversation.customer.name} size="lg" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-ink truncate text-sm font-semibold">
              {conversation.customer.name}
            </h2>
            <span className="text-ink-muted text-xs">
              {conversation.customer.handle} · {channelLabel(conversation.channel)}
            </span>
            <span className="text-ink-subtle font-mono text-[11px]" data-numeric>
              {conversation.id}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge tone={status.tone} size="sm" srPrefix="Status">
              {status.label}
            </Badge>
            <Badge tone="neutral" size="sm" srPrefix="Intent">
              {INTENT_META[conversation.intent]}
            </Badge>
            <Badge tone={sentiment.tone} size="sm" srPrefix="Sentiment">
              {sentiment.label}
            </Badge>
            <Badge tone={priority.tone} size="sm" srPrefix="Priority">
              {priority.label}
            </Badge>
            <Badge tone={conversation.assignedTo ? "info" : "neutral"} size="sm" srPrefix="Assignment">
              {conversation.assignedTo
                ? `Assigned · ${conversation.assignedTo.name}`
                : "Unassigned"}
            </Badge>
            {unread ? (
              <Badge tone="primary" size="sm" srPrefix="Read state">
                Unread
              </Badge>
            ) : null}
          </div>

          <SLAIndicator evaluation={sla} className="mt-2 text-xs" />
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={updatingRead}
          onClick={() => onSetRead(unread)}
        >
          {unread ? (
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
      </div>

      <div className="border-line flex flex-wrap items-center gap-1.5 border-t px-5 py-2">
        <Button variant="ghost" size="sm" onClick={onShowAiAssist} disabled={!canUseAi}>
          <Sparkles className="text-ai size-3.5" aria-hidden="true" />
          AI Assist
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowCustomerHistory}>
          <UserRound className="size-3.5" aria-hidden="true" />
          Customer Context
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowConversationHistory}>
          <History className="size-3.5" aria-hidden="true" />
          Conversation History
        </Button>
        <Button variant="ghost" size="sm" onClick={onAssign} disabled={!canAssign}>
          <UserPlus className="size-3.5" aria-hidden="true" />
          Assign
        </Button>
        <Button variant="ghost" size="sm" onClick={onEscalate} disabled={!canEscalate}>
          <ShieldAlert className="size-3.5" aria-hidden="true" />
          Escalate
        </Button>
        <Button variant="ghost" size="sm" onClick={onAddNote} disabled={!canReply}>
          <StickyNote className="size-3.5" aria-hidden="true" />
          Add Note
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowResolve} disabled={!canResolve}>
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {isResolved ? "Reopen" : "Resolve"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveToPrivate}
          disabled={!canMoveToPrivate}
          title={canMoveToPrivate ? undefined : "Only a public conversation can be moved to a direct message."}
        >
          <Lock className="size-3.5" aria-hidden="true" />
          Move to Private
        </Button>
      </div>
    </header>
  );
}
