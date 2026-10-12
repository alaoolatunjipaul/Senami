"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUp,
  Clock,
  Download,
  FileCode,
  FileText,
  History,
  MessageSquare,
  MessagesSquare,
  Send,
  Sparkles,
  User,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingState, EmptyState } from "@/components/ui/states";
import { ConversationHistoryPanel } from "@/features/conversation/conversation-history-panel";
import { CustomerContextPanel } from "@/features/conversation/customer-context-panel";
import { CustomerHistoryPanel } from "@/features/conversation/customer-history-panel";
import { EscalateDialog } from "@/features/conversation/escalate-dialog";
import { ResponseComposerModal } from "@/features/conversation/response-composer-modal";
import { TrainAiModal } from "@/features/conversation/train-ai-modal";
import {
  useConversationAudit,
  useConversationDetail,
  useConversationMessages,
  useCustomerContext,
  useCustomerHistory,
  useEscalateConversation,
  useRecordOpen,
  useSendMessage,
} from "@/features/conversation/use-conversation";
import type { InboxConversationDto } from "@/lib/domain/inbox";
import { formatRelativeTime } from "@/lib/format";

export interface ConversationWorkspaceProps {
  conversationId: string | null;
  summary: InboxConversationDto | null;
  now: Date;
  updatingRead: boolean;
  onSetRead: (read: boolean) => void;
  onConversationCreated?: (id: string) => void;
}

export function ConversationWorkspace({
  conversationId,
  summary,
  now,
  onConversationCreated,
}: ConversationWorkspaceProps) {
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [customerContextOpen, setCustomerContextOpen] = useState(false);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);
  const [conversationHistoryOpen, setConversationHistoryOpen] = useState(false);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [trainAiModalOpen, setTrainAiModalOpen] = useState(false);

  const detail = useConversationDetail(conversationId);
  const messages = useConversationMessages(conversationId);
  const audit = useConversationAudit(conversationId);
  const customer = useCustomerContext(conversationId);
  const customerHistory = useCustomerHistory(conversationId);
  const recordOpen = useRecordOpen(conversationId);
  const sendMessage = useSendMessage(conversationId);
  const escalate = useEscalateConversation(conversationId);

  const conversation = detail.data?.conversation ?? summary;

  // Open audit
  useEffect(() => {
    if (conversationId === null) return;
    recordOpen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Global hotkeys for Ctrl+Enter, t, m
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        setResponseModalOpen(true);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setTrainAiModalOpen(true);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleSendMyself();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleSendMyself = useCallback(() => {
    toast.success("Marked as handled: response will be sent directly by agent.");
  }, []);

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          title="No conversation selected"
          description="Choose a conversation from the inbox list to view its thread and response tools."
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
        description="This conversation could not be loaded."
        onRetry={() => void detail.refetch()}
        retrying={detail.isFetching}
      />
    );
  }

  const subject = conversation.subject || "Let's Hear From You - TPA Scheme Survey";
  const interactionRef = conversation.interactionId || "EML-H6G6";
  const accountRef = conversation.account || "Not provided";
  const overdueDisplay = conversation.slaOverdueDisplay || "-65:14:41 over SLA";

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas select-none">
      {/* Top Workspace Header matching screenshot */}
      <div className="border-line bg-surface shrink-0 border-b px-6 pt-5 pb-4">
        {/* Row 1: Subject + Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-ink text-xl md:text-2xl font-bold tracking-tight">
            {subject}
          </h1>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 rounded-full px-2.5 py-0.5 text-xs font-semibold inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              New
            </span>

            <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 rounded-full px-2.5 py-0.5 text-xs font-medium">
              Enquiry
            </span>

            <span className="bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900/40 rounded-full px-2.5 py-0.5 text-xs font-medium inline-flex items-center gap-1">
              <Clock className="size-3 shrink-0" />
              <span>{overdueDisplay}</span>
            </span>
          </div>
        </div>

        {/* Row 2: Sender info & Action buttons */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-bold">
              {conversation.customer.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs">
              <span className="text-ink font-semibold">
                {conversation.customer.name}
              </span>
              <span className="text-ink-muted ml-1">
                &lt;{conversation.customer.handle}&gt; · {formatRelativeTime(conversation.lastMessageAt, now)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomerContextOpen(true)}
              className="border-line bg-surface hover:bg-surface-muted text-ink inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            >
              <User className="size-3 text-ink-muted" />
              <span>Customer history</span>
            </button>

            <button
              type="button"
              onClick={() => setConversationHistoryOpen(true)}
              className="border-line bg-surface hover:bg-surface-muted text-ink inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            >
              <History className="size-3 text-ink-muted" />
              <span>Interaction history</span>
            </button>

            <button
              type="button"
              onClick={() => setEscalateOpen(true)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
            >
              <ArrowUp className="size-3" />
              <span>Escalate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Conversation Scrollable Area */}
      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
        {/* Conversation Card Container matching screenshot */}
        <div className="border-line bg-surface rounded-xl border p-5 shadow-xs">
          {/* Conversation header */}
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold text-xs">
                D
              </span>
              <span className="text-ink text-sm font-bold">Conversation</span>
            </div>

            <span className="bg-surface-muted text-ink-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
              1 message
            </span>
          </div>

          {/* Metadata labels row */}
          <div className="flex items-center gap-6 py-3 text-xs border-b border-line">
            <div>
              <span className="text-ink-subtle font-medium text-[11px] uppercase mr-2">INTERACTION</span>
              <span className="text-ink font-mono font-medium">{interactionRef}</span>
            </div>
            <div>
              <span className="text-ink-subtle font-medium text-[11px] uppercase mr-2">ACCOUNT</span>
              <span className="text-ink font-medium">{accountRef}</span>
            </div>
          </div>

          {/* Blue-bordered Message Card matching screenshot */}
          <div className="mt-4 rounded-lg border border-blue-400/80 dark:border-blue-600/80 bg-canvas p-5 shadow-xs">
            {/* Message header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-bold">
                {conversation.customer.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-ink text-xs font-bold">{conversation.customer.name}</span>
              <span className="text-ink-subtle text-xs">3d ago</span>
            </div>

            {/* Message body */}
            <div className="text-xs text-ink leading-relaxed space-y-3 font-sans">
              <p>
                {conversation.customer.name} ({conversation.customer.handle}) has sent you a protected message.
              </p>

              <p>
                <a
                  href="#read"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Decrypted via Microsoft Purview Message Encryption certificate.");
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-block"
                >
                  Read the message
                </a>
              </p>

              <p className="text-ink-muted text-[11px]">
                Learn about messages protected by Microsoft Purview Message Encryption.
              </p>

              <p>
                <a
                  href="#privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("FirstBank Customer Data Privacy Statement viewed.");
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline inline-block"
                >
                  Privacy Statement
                </a>
              </p>

              <div className="text-ink-subtle text-[11px] pt-1 border-t border-line space-y-0.5">
                <p>Learn more on message encryption.</p>
                <p>Microsoft Corporation, One Microsoft Way, Redmond, WA 98052</p>
              </div>
            </div>
          </div>
        </div>

        {/* Attachment Card matching screenshot */}
        <div>
          <h2 className="text-ink-subtle text-[11px] font-bold tracking-wider uppercase mb-2">
            1 ATTACHMENT
          </h2>

          <div className="border-line bg-surface hover:bg-surface-muted flex items-center justify-between rounded-xl border p-3 shadow-xs transition-colors w-full max-w-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <FileCode className="size-4" />
              </span>
              <div>
                <p className="text-ink font-semibold text-xs">message.rpmsg</p>
                <p className="text-ink-muted text-[11px]">2.3 MB</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toast.success("Protected file message.rpmsg downloaded securely.")}
              className="text-ink-subtle hover:text-ink p-1 rounded"
              title="Download attachment"
            >
              <Download className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Toolbar matching screenshot */}
      <div className="border-line bg-surface shrink-0 border-t px-6 py-3.5 shadow-sm">
        <div className="flex items-center justify-start gap-3">
          {/* Send Response Button */}
          <button
            type="button"
            onClick={() => setResponseModalOpen(true)}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center gap-2 rounded-lg py-2.5 px-6 font-medium text-xs shadow-xs transition-colors"
          >
            <Send className="size-3.5" />
            <span>Send response</span>
            <kbd className="bg-blue-700/60 rounded px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl ↵
            </kbd>
          </button>

          {/* Train AI Button */}
          <button
            type="button"
            onClick={() => setTrainAiModalOpen(true)}
            className="border-line bg-surface hover:bg-surface-muted text-ink flex items-center gap-2 rounded-lg border py-2.5 px-4 font-medium text-xs transition-colors"
          >
            <Sparkles className="size-3.5 text-indigo-600" />
            <span>Train AI</span>
            <kbd className="border-line text-ink-subtle rounded border px-1.5 py-0.5 font-mono text-[10px]">
              t
            </kbd>
          </button>

          {/* I'll send it myself Button */}
          <button
            type="button"
            onClick={handleSendMyself}
            className="border-line bg-surface hover:bg-surface-muted text-ink flex items-center gap-2 rounded-lg border py-2.5 px-4 font-medium text-xs transition-colors"
          >
            <Check className="size-3.5 text-emerald-600" />
            <span>I'll send it myself</span>
            <kbd className="border-line text-ink-subtle rounded border px-1.5 py-0.5 font-mono text-[10px]">
              m
            </kbd>
          </button>
        </div>
      </div>

      {/* Dialogs and Drawers */}
      <ResponseComposerModal
        open={responseModalOpen}
        onOpenChange={setResponseModalOpen}
        conversation={conversation}
        onSent={(body) => {
          sendMessage.mutate({
            kind: "private",
            body,
            attachments: [],
            author: { id: "usr_agent_olatunji", name: "OLATUNJI ALAO", type: "agent" },
          });
        }}
      />

      <TrainAiModal open={trainAiModalOpen} onOpenChange={setTrainAiModalOpen} />

      <EscalateDialog
        key={`escalate-${escalateOpen}`}
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        pending={escalate.isPending}
        error={escalate.isError ? (escalate.error as Error).message : null}
        onEscalate={(input) =>
          escalate.mutate(input, {
            onSuccess: () => {
              setEscalateOpen(false);
              toast.success("Conversation escalated to designated supervisor queue.");
            },
          })
        }
      />

      <CustomerContextPanel
        open={customerContextOpen}
        onOpenChange={setCustomerContextOpen}
        customer={customer.data?.customer ?? null}
        loading={customer.isLoading}
        error={customer.isError}
        onRetry={() => void customer.refetch()}
        activeConversationId={conversationId}
        onOpenInteraction={(id) => {
          setCustomerContextOpen(false);
          onConversationCreated?.(id);
        }}
        onOpenFullHistory={() => setCustomerHistoryOpen(true)}
        now={now}
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
    </div>
  );
}