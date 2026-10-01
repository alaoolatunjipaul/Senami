"use client";

import { useState } from "react";

import { ErrorState, LoadingState, EmptyState } from "@/components/ui/states";
import { AssignDialog } from "@/features/conversation/assign-dialog";
import { ConversationHeader } from "@/features/conversation/conversation-header";
import { ConversationHistoryPanel } from "@/features/conversation/conversation-history-panel";
import { CustomerHistoryPanel } from "@/features/conversation/customer-history-panel";
import { EscalateDialog } from "@/features/conversation/escalate-dialog";
import { MessageTimeline } from "@/features/conversation/message-timeline";
import { MoveToPrivateDialog } from "@/features/conversation/move-to-private-dialog";
import { ResponseComposer } from "@/features/conversation/response-composer";
import {
  useAssignConversation,
  useConversationAudit,
  useConversationDetail,
  useConversationMessages,
  useCustomerHistory,
  useEscalateConversation,
  useMoveToPrivate,
  useSendMessage,
} from "@/features/conversation/use-conversation";
import { useSession } from "@/features/shell/session-context";
import type { ComposerMode } from "@/lib/domain/conversation";
import type { InboxConversationDto } from "@/lib/domain/inbox";
import { canAssignConversation } from "@/server/conversations/policy";
import { can } from "@/server/rbac/permissions";

/**
 * Conversation workspace (§8).
 *
 * The full conversation surface: header, timeline, composer and every action the
 * phase requires. It owns its own data query (list card data is used only as a
 * placeholder while the detail loads) and re-renders on every mutation because
 * the mutations invalidate the conversation's query cache.
 */
export interface ConversationWorkspaceProps {
  conversationId: string | null;
  /** The list card for the same conversation, used while the detail loads. */
  summary: InboxConversationDto | null;
  now: Date;
  updatingRead: boolean;
  onSetRead: (read: boolean) => void;
  /** Called after a public-to-private move so the inbox can select the new DM. */
  onConversationCreated?: (id: string) => void;
}

export function ConversationWorkspace({
  conversationId,
  summary,
  now,
  updatingRead,
  onSetRead,
  onConversationCreated,
}: ConversationWorkspaceProps) {
  const session = useSession();
  const [composerMode, setComposerMode] = useState<ComposerMode>("public");
  const [assignOpen, setAssignOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);
  const [conversationHistoryOpen, setConversationHistoryOpen] = useState(false);

  const detail = useConversationDetail(conversationId);
  const messages = useConversationMessages(conversationId);
  const audit = useConversationAudit(conversationId);
  const history = useCustomerHistory(conversationId);

  const sendMessage = useSendMessage(conversationId);
  const assign = useAssignConversation(conversationId);
  const escalate = useEscalateConversation(conversationId);
  const moveToPrivate = useMoveToPrivate(conversationId);

  const conversation = detail.data?.conversation ?? summary;
  const thread = detail.data?.thread ?? null;

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          title="No conversation selected"
          description="Choose a conversation from the list to see its timeline, or search for a customer."
        />
      </div>
    );
  }

  if (!conversation && detail.isLoading) {
    return <LoadingState label="Loading conversation…" />;
  }

  if (!conversation) {
    return (
      <ErrorState
        title="Conversation unavailable"
        description="This conversation could not be loaded. It may have been removed or you may not have access."
        onRetry={() => void detail.refetch()}
        retrying={detail.isFetching}
      />
    );
  }

  const canReply = can(session.user.role, "conversation.reply");
  const canEscalate = can(session.user.role, "conversation.escalate");
  const assignDecision = canAssignConversation(session.user.role, {
    currentAssigneeId: conversation.assignedTo?.id ?? null,
    actorId: session.user.id,
  });
  const canMoveToPrivate =
    canReply && thread?.type === "public" && thread.movedToConversationId === null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ConversationHeader
        conversation={conversation}
        now={now}
        unread={conversation.unread}
        updatingRead={updatingRead}
        canReply={canReply}
        canEscalate={canEscalate}
        canAssign={assignDecision.allowed}
        canMoveToPrivate={canMoveToPrivate}
        onSetRead={onSetRead}
        onShowCustomerHistory={() => setCustomerHistoryOpen(true)}
        onShowConversationHistory={() => setConversationHistoryOpen(true)}
        onAssign={() => setAssignOpen(true)}
        onEscalate={() => setEscalateOpen(true)}
        onMoveToPrivate={() => setMoveOpen(true)}
        onAddNote={() => setComposerMode("internal_note")}
      />

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {messages.isLoading ? (
          <LoadingState label="Loading the conversation…" />
        ) : messages.isError ? (
          <ErrorState
            title="Unable to load messages"
            description="The conversation timeline could not be loaded."
            onRetry={() => void messages.refetch()}
            retrying={messages.isFetching}
          />
        ) : (
          <MessageTimeline messages={messages.data?.messages ?? []} now={now} />
        )}
      </div>

      <ResponseComposer
        mode={composerMode}
        onModeChange={setComposerMode}
        allowed={canReply}
        onSend={(variables) => sendMessage.mutateAsync(variables).then(() => undefined)}
      />

      <CustomerHistoryPanel
        open={customerHistoryOpen}
        onOpenChange={setCustomerHistoryOpen}
        history={history.data ?? null}
        loading={history.isLoading}
        error={history.isError}
        onRetry={() => void history.refetch()}
        now={now}
      />

      <ConversationHistoryPanel
        open={conversationHistoryOpen}
        onOpenChange={setConversationHistoryOpen}
        events={audit.data?.events ?? []}
        loading={audit.isLoading}
        error={audit.isError}
        onRetry={() => void audit.refetch()}
        now={now}
      />

      <AssignDialog
        key={`assign-${assignOpen}`}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        conversation={conversation}
        assignees={thread?.assignees ?? []}
        pending={assign.isPending}
        error={assign.isError ? (assign.error as Error).message : null}
        onAssign={(assigneeId) =>
          assign.mutate(
            { assigneeId },
            { onSuccess: () => setAssignOpen(false) },
          )
        }
      />

      <EscalateDialog
        key={`escalate-${escalateOpen}`}
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        pending={escalate.isPending}
        error={escalate.isError ? (escalate.error as Error).message : null}
        onEscalate={(input) =>
          escalate.mutate(input, { onSuccess: () => setEscalateOpen(false) })
        }
      />

      <MoveToPrivateDialog
        key={`move-${moveOpen}`}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        pending={moveToPrivate.isPending}
        error={moveToPrivate.isError ? (moveToPrivate.error as Error).message : null}
        onConfirm={(input) =>
          moveToPrivate.mutate(input, {
            onSuccess: (result) => {
              setMoveOpen(false);
              onConversationCreated?.(result.created.id);
            },
          })
        }
      />
    </div>
  );
}
