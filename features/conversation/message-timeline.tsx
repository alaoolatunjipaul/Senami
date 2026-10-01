"use client";

import { EmptyState } from "@/components/ui/states";
import { MessageBubble } from "@/features/conversation/message-bubble";
import type { ConversationMessageDto } from "@/lib/domain/conversation";

/**
 * Conversation timeline.
 *
 * Public messages, private replies, internal notes, AI-generated content and
 * system events, all in one ordered stream. Ordering is delegated to
 * `sortTimeline` so the timeline is stable even when seeded messages share a
 * timestamp.
 */
export interface MessageTimelineProps {
  messages: readonly ConversationMessageDto[];
  now: Date;
}

export function MessageTimeline({ messages, now }: MessageTimelineProps) {
  if (messages.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        description="This conversation has no messages. Send the first reply or add an internal note."
      />
    );
  }

  return (
    <ol aria-label="Conversation timeline" className="flex flex-col gap-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} now={now} />
      ))}
    </ol>
  );
}
