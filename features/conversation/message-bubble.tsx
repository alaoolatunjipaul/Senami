"use client";

import { Bot, FileText, Image as ImageIcon, Paperclip, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MESSAGE_KIND_META, type Tone } from "@/lib/domain/taxonomy";
import {
  formatFileSize,
  type ConversationMessageDto,
  type MessageAttachment,
} from "@/lib/domain/conversation";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A single message in the conversation timeline.
 *
 * The kind badge is not decorative: spec section 3 makes the public/private
 * distinction the defining rule of the product, so every message states its
 * visibility in text, not colour alone. Internal notes and system events are
 * additionally shaped differently so they can never be mistaken for something
 * the customer saw.
 */

const ATTACHMENT_ICONS: Record<MessageAttachment["kind"], LucideIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Paperclip,
  document: FileText,
  other: Paperclip,
};

export interface MessageBubbleProps {
  message: ConversationMessageDto;
  now: Date;
}

export function MessageBubble({ message, now }: MessageBubbleProps) {
  const meta = MESSAGE_KIND_META[message.kind];

  if (message.kind === "system") {
    return (
      <li className="flex justify-center py-1">
        <p className="text-ink-muted bg-surface-muted rounded-full px-3 py-1 text-[11px]">
          <span className="sr-only">System event: </span>
          {message.body} · {formatRelativeTime(message.createdAt, now)}
        </p>
      </li>
    );
  }

  const outbound = message.direction === "outbound";
  const internal = message.kind === "internal_note";

  return (
    <li className={cn("flex gap-2.5", outbound ? "flex-row-reverse" : "flex-row")}>
      <Avatar name={message.author.name} size="sm" className="mt-0.5" />

      <div className={cn("flex min-w-0 max-w-[80%] flex-col", outbound ? "items-end" : "items-start")}>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-ink-secondary text-xs font-medium">
            {message.author.name}
            {outbound && message.kind !== "internal_note" && message.kind !== "ai_generated" ? (
              <span className="text-ink-subtle ml-1 text-[11px]">(Agent)</span>
            ) : null}
          </span>
          <Badge tone={meta.tone as Tone} size="sm" srPrefix="Message type">
            {meta.label}
          </Badge>
          {message.kind === "ai_generated" ? (
            <span className="text-ink-subtle inline-flex items-center gap-1 text-[11px]">
              <Bot className="size-3" aria-hidden="true" />
              {message.aiConfidence !== null
                ? `${Math.round(message.aiConfidence * 100)}% confidence`
                : "AI generated"}
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            internal
              ? "border-dashed border-warning-muted bg-warning-subtle text-ink-secondary"
              : message.kind === "public"
                ? "border-line-strong bg-surface text-ink"
                : "border-visibility-private-muted bg-visibility-private-subtle text-ink",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.body}</p>

          {message.attachments.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {message.attachments.map((attachment) => {
                const Icon = ATTACHMENT_ICONS[attachment.kind];
                return (
                  <li
                    key={attachment.id}
                    className="border-line bg-canvas flex items-center gap-2 rounded-sm border px-2 py-1 text-xs"
                  >
                    <Icon className="text-ink-muted size-3.5" aria-hidden="true" />
                    <span className="text-ink-secondary truncate">{attachment.name}</span>
                    <span className="text-ink-subtle ml-auto shrink-0" data-numeric>
                      {formatFileSize(attachment.sizeBytes)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <time
          dateTime={message.createdAt}
          title={formatDateTime(message.createdAt)}
          className="text-ink-subtle mt-1 text-[11px]"
        >
          {formatRelativeTime(message.createdAt, now)}
        </time>
      </div>
    </li>
  );
}
