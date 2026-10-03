"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState, EmptyState } from "@/components/ui/states";
import { AiAssistPanel } from "@/features/conversation/ai-assist-panel";
import { AssignDialog } from "@/features/conversation/assign-dialog";
import { ConversationHeader } from "@/features/conversation/conversation-header";
import { ConversationHistoryPanel } from "@/features/conversation/conversation-history-panel";
import { CustomerHistoryPanel } from "@/features/conversation/customer-history-panel";
import { CustomerContextPanel } from "@/features/conversation/customer-context-panel";
import { CustomerContextPane } from "@/features/conversation/customer-context-pane";
import { EscalateDialog } from "@/features/conversation/escalate-dialog";
import { MessageTimeline } from "@/features/conversation/message-timeline";
import { MoveToPrivateDialog } from "@/features/conversation/move-to-private-dialog";
import { ResolveDialog } from "@/features/conversation/resolve-dialog";
import {
  ResponseComposer,
  type ComposerDraftEvent,
  type ComposerSendVariables,
  type ResponseComposerHandle,
} from "@/features/conversation/response-composer";
import { SendConfirmationDialog } from "@/features/conversation/send-confirmation-dialog";
import {
  useAiSuggestion,
  useAssignConversation,
  useConversationAudit,
  useConversationDetail,
  useConversationMessages,
  useConversationStatus,
  useCustomerContext,
  useCustomerHistory,
  useEscalateConversation,
  useMoveToPrivate,
  useRecordDraftEdit,
  useRecordOpen,
  useSendMessage,
} from "@/features/conversation/use-conversation";
import { useSession } from "@/features/shell/session-context";
import type { AiAction, AiSuggestionDto } from "@/lib/domain/ai";
import { COMPOSER_MODE_META, type ComposerMode } from "@/lib/domain/conversation";
import type { InboxConversationDto } from "@/lib/domain/inbox";
import { canAssignConversation, canUseAiAssist, canUseAiAssistOn } from "@/server/conversations/policy";
import { can } from "@/server/rbac/permissions";

/**
 * Conversation workspace (§8).
 *
 * The full conversation surface: header, timeline, composer and every action the
 * phase requires. It owns its own data query (list card data is used only as a
 * placeholder while the detail loads) and re-renders on every mutation because
 * the mutations invalidate the conversation's query cache.
 *
 * Phase 8 adds the professional flow on top: AI drafting assistance, the richer
 * customer context panel, resolve/reopen with an explicit confirmation, and a
 * confirmation before anything customer-facing leaves the building.
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

interface PendingSend {
  readonly mode: ComposerMode;
  readonly body: string;
  readonly confirm: (confirmed: boolean) => void;
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
  const [resolveOpen, setResolveOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [customerContextOpen, setCustomerContextOpen] = useState(false);
  // The docked right-hand pane is the default on a wide viewport; the drawer is
  // still available for narrower screens and for the explicit "Customer Context"
  // action, so nothing existing is removed.
  const [contextPaneDismissed, setContextPaneDismissed] = useState(false);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);
  const [conversationHistoryOpen, setConversationHistoryOpen] = useState(false);
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  // Keyed by conversation so switching threads cannot show the previous
  // conversation's AI output.
  const [suggestionState, setSuggestionState] = useState<{
    conversationId: string;
    suggestion: AiSuggestionDto;
  } | null>(null);
  const [draftText, setDraftText] = useState("");

  const composerRef = useRef<ResponseComposerHandle | null>(null);
  const [wideViewport, setWideViewport] = useState(false);

  // The three-column Response Desk only fits on a wide viewport; below the xl
  // breakpoint the right pane is dropped and the drawer remains the way in.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const sync = () => setWideViewport(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const showContextPane = wideViewport && !contextPaneDismissed;

  const detail = useConversationDetail(conversationId);
  const messages = useConversationMessages(conversationId);
  const audit = useConversationAudit(conversationId);
  const customer = useCustomerContext(conversationId);
  const customerHistory = useCustomerHistory(conversationId);
  const recordOpen = useRecordOpen(conversationId);
  const recordDraftEdit = useRecordDraftEdit(conversationId);

  const sendMessage = useSendMessage(conversationId);
  const assign = useAssignConversation(conversationId);
  const escalate = useEscalateConversation(conversationId);
  const moveToPrivate = useMoveToPrivate(conversationId);
  const status = useConversationStatus(conversationId);
  const ai = useAiSuggestion(conversationId);

  const conversation = detail.data?.conversation ?? summary;
  const thread = detail.data?.thread ?? null;

  // Opening a conversation is audited once per agent; the route is idempotent.
  useEffect(() => {
    if (conversationId === null) return;
    recordOpen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const suggestion =
    suggestionState !== null && suggestionState.conversationId === conversationId
      ? suggestionState.suggestion
      : null;

  const confirmSend = useCallback((variables: ComposerSendVariables) => {
    const mode = variables.kind as ComposerMode;
    if (!COMPOSER_MODE_META[mode].customerFacing) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      setPendingSend({
        mode,
        body: variables.body,
        confirm: (confirmed: boolean) => {
          setPendingSend(null);
          resolve(confirmed);
        },
      });
    });
  }, []);

  const handleDraftEvent = useCallback(
    (event: ComposerDraftEvent) => {
      if (conversationId === null) return;
      recordDraftEdit.mutate({
        action: event.type === "adopted" ? "adopted" : "cleared",
        source: event.type === "adopted" ? "ai" : "agent",
        characters: event.type === "adopted" ? event.body.length : 0,
      });
    },
    [conversationId, recordDraftEdit],
  );

  const runAi = useCallback(
    (action: AiAction, input?: string) => {
      if (conversationId === null) return;
      ai.mutate(
        { action, input },
        {
          onSuccess: (result) =>
            setSuggestionState({ conversationId, suggestion: result.suggestion }),
        },
      );
    },
    [ai, conversationId],
  );

  const adoptSuggestion = useCallback(
    (content: string) => {
      composerRef.current?.insertDraft(content);
    },
    [],
  );

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
  const canUseAi =
    canUseAiAssist(session.user.role) && (thread === null || canUseAiAssistOn(session.user.role, thread));
  const canResolve = can(session.user.role, "conversation.resolve");
  const alreadyResolved = conversation.status === "resolved" || conversation.status === "closed";

  return (
    <div className="flex h-full min-h-0">
      {/*
        Response Desk structure: the conversation is the dominant column and owns
        the single primary scroll (header + timeline + composer are fixed within
        the viewport), while customer context docks to the right and scrolls on
        its own. Neither pane scrolls the page, so nothing nests.
      */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ConversationHeader
        conversation={conversation}
        now={now}
        unread={conversation.unread}
        updatingRead={updatingRead}
        canReply={canReply}
        canEscalate={canEscalate}
        canAssign={assignDecision.allowed}
        canMoveToPrivate={canMoveToPrivate}
        canUseAi={canUseAi}
        canResolve={canResolve}
        onSetRead={onSetRead}
        onShowCustomerHistory={() => {
          // On a wide viewport the same facts are already docked on the right, so
          // the action re-opens the drawer only when the pane is not shown.
          setCustomerContextOpen(!showContextPane);
        }}
        onShowConversationHistory={() => setConversationHistoryOpen(true)}
        onToggleContextPane={
          wideViewport ? () => setContextPaneDismissed((value) => !value) : undefined
        }
        contextPaneVisible={showContextPane}
        onAssign={() => setAssignOpen(true)}
        onEscalate={() => setEscalateOpen(true)}
        onMoveToPrivate={() => setMoveOpen(true)}
        onAddNote={() => setComposerMode("internal_note")}
        onShowAiAssist={() => setAiOpen(true)}
        onShowResolve={() => setResolveOpen(true)}
      />

      {/*
        The one primary scroll in the centre column. The inner measure is capped
        so a long thread stays readable instead of stretching to a 4K monitor,
        and the generous vertical rhythm removes the cramped feel of a small
        fixed-height chat box.
      */}
      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto w-full max-w-3xl">
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
      </div>

      <ResponseComposer
        ref={composerRef}
        mode={composerMode}
        onModeChange={setComposerMode}
        allowed={canReply}
        beforeSend={confirmSend}
        onDraftEvent={handleDraftEvent}
        onDraftChange={setDraftText}
        onSend={(variables) => sendMessage.mutateAsync(variables).then(() => undefined)}
      />

      <SendConfirmationDialog
        open={pendingSend !== null}
        mode={pendingSend?.mode ?? composerMode}
        body={pendingSend?.body ?? ""}
        onConfirm={() => pendingSend?.confirm(true)}
        onCancel={() => pendingSend?.confirm(false)}
      />

      <AiAssistPanel
        open={aiOpen}
        onOpenChange={setAiOpen}
        draft={draftText}
        suggestion={suggestion}
        pending={ai.isPending}
        error={ai.isError ? (ai.error as Error).message : null}
        onAdopt={adoptSuggestion}
        onRun={runAi}
      />

      <ResolveDialog
        key={`resolve-${resolveOpen}`}
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        pending={status.isPending}
        error={status.isError ? (status.error as Error).message : null}
        alreadyResolved={alreadyResolved}
        onResolve={(note) =>
          status.mutate(
            { status: "resolved", note },
            { onSuccess: () => setResolveOpen(false) },
          )
        }
        onReopen={() =>
          status.mutate(
            { status: "open", reason: "Reopened from the conversation workspace." },
            { onSuccess: () => setResolveOpen(false) },
          )
        }
      />

      <CustomerContextPanel
        open={customerContextOpen}
        onOpenChange={setCustomerContextOpen}
        customer={customer.data?.customer ?? null}
        loading={customer.isLoading}
        error={customer.isError}
        onRetry={() => void customer.refetch()}
      />

      <CustomerHistoryPanel
        open={customerHistoryOpen}
        onOpenChange={setCustomerHistoryOpen}
        history={customerHistory.data ?? null}
        loading={customerHistory.isLoading}
        error={customerHistory.isError}
        onRetry={() => void customerHistory.refetch()}
        now={now}
        activeConversationId={conversationId}
        onOpenInteraction={(id) => {
          setCustomerHistoryOpen(false);
          onConversationCreated?.(id);
        }}
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

      {showContextPane ? (
        <CustomerContextPane
          customer={customer.data?.customer ?? null}
          loading={customer.isLoading}
          error={customer.isError}
          onRetry={() => void customer.refetch()}
          activeConversationId={conversationId}
          onOpenInteraction={(id) => onConversationCreated?.(id)}
          onOpenFullHistory={() => setCustomerHistoryOpen(true)}
          now={now}
        />
      ) : null}
    </div>
  );
}