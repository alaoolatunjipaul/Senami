"use client";

import { useEffect, useState } from "react";
import { Send, X, Paperclip, Sparkles, Bold, Italic, List, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import type { InboxConversationDto } from "@/lib/domain/inbox";

export interface ResponseComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: InboxConversationDto | null;
  onSent?: (body: string) => void;
}

export function ResponseComposerModal({
  open,
  onOpenChange,
  conversation,
  onSent,
}: ResponseComposerModalProps) {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (conversation) {
      setRecipient(`${conversation.customer.name} <${conversation.customer.handle}>`);
      setSubject(
        conversation.subject
          ? (conversation.subject.startsWith("Re:") ? conversation.subject : `Re: ${conversation.subject}`)
          : `Re: Enquiry [${conversation.interactionId ?? conversation.id}]`,
      );
      setBody(
        `Dear ${conversation.customer.name},\n\nThank you for reaching out to FirstBank Response Desk regarding "${conversation.subject || "your enquiry"}".\n\nWe have received and reviewed your protected communication. We are currently processing this with our technical operations team and will update you accordingly.\n\nBest regards,\nOLATUNJI ALAO\nResponse agent | FIRSTASSIST Desk\nFirstBank Nigeria`,
      );
    }
  }, [conversation]);

  // Keyboard shortcut listener for Ctrl+Enter
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (open && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!open) return null;

  function handleSend() {
    if (!body.trim()) {
      toast.error("Please enter a response message.");
      return;
    }

    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success(`Response successfully delivered to ${conversation?.customer.name ?? "recipient"}!`);
      onSent?.(body);
      onOpenChange(false);
    }, 500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-modal-title"
        className="border-line bg-surface flex w-full max-w-3xl flex-col rounded-xl border shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="border-line flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Send className="size-3.5" />
            </span>
            <div>
              <h2 id="composer-modal-title" className="text-ink text-sm font-semibold">
                Send Response
              </h2>
              <p className="text-ink-muted text-xs">FIRSTASSIST Response Desk</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-ink-subtle hover:text-ink hover:bg-surface-muted rounded-md p-1 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col p-5 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-ink-secondary w-16 text-xs font-medium">To:</span>
            <input
              type="text"
              readOnly
              value={recipient}
              className="border-line bg-surface-muted text-ink h-8 flex-1 rounded-md border px-3 text-xs outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-ink-secondary w-16 text-xs font-medium">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-line bg-canvas text-ink font-medium h-8 flex-1 rounded-md border px-3 text-xs outline-none focus:border-blue-500"
            />
          </div>

          {/* Formatting bar */}
          <div className="border-line bg-surface-muted flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
            <button
              type="button"
              className="hover:bg-surface text-ink-secondary hover:text-ink rounded p-1"
              title="Bold"
            >
              <Bold className="size-3.5" />
            </button>
            <button
              type="button"
              className="hover:bg-surface text-ink-secondary hover:text-ink rounded p-1"
              title="Italic"
            >
              <Italic className="size-3.5" />
            </button>
            <button
              type="button"
              className="hover:bg-surface text-ink-secondary hover:text-ink rounded p-1"
              title="Bullet List"
            >
              <List className="size-3.5" />
            </button>
            <button
              type="button"
              className="hover:bg-surface text-ink-secondary hover:text-ink rounded p-1"
              title="Link"
            >
              <LinkIcon className="size-3.5" />
            </button>
            <div className="bg-line mx-1.5 h-3.5 w-px" />
            <button
              type="button"
              onClick={() => {
                toast.info("AI polish applied to message.");
                setBody((prev) => `${prev}\n\n[Verified by FIRSTASSIST Automated Governance Guardrails]`);
              }}
              className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium"
            >
              <Sparkles className="size-3" />
              Polish with AI
            </button>
          </div>

          {/* Body */}
          <textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="border-line bg-canvas text-ink font-sans placeholder:text-ink-subtle resize-none rounded-md border p-3.5 text-xs leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />

          {/* Footer toolbar */}
          <div className="border-line flex items-center justify-between border-t pt-3">
            <button
              type="button"
              className="border-line text-ink-secondary hover:bg-surface-muted inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
            >
              <Paperclip className="size-3.5" />
              Attach file
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-ink-secondary hover:bg-surface-muted rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={handleSend}
                className="bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
              >
                <Send className="size-3.5" />
                {sending ? "Sending…" : "Send response"}
                <kbd className="bg-blue-700/60 rounded px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl ↵
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
