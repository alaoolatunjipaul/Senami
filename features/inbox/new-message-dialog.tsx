"use client";

import { useState } from "react";
import { Send, X, Paperclip, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewMessageDialog({ open, onOpenChange }: NewMessageDialogProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [queue, setQueue] = useState("Social Desk");
  const [sending, setSending] = useState(false);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim()) {
      toast.error("Please enter a recipient.");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject.");
      return;
    }

    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success(`Message sent successfully to ${to}!`);
      onOpenChange(false);
      setTo("");
      setSubject("");
      setBody("");
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-message-title"
        className="border-line bg-surface flex w-full max-w-2xl flex-col rounded-xl border shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="border-line flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Send className="size-3.5" />
            </span>
            <div>
              <h2 id="new-message-title" className="text-ink text-sm font-semibold">
                Compose New Message
              </h2>
              <p className="text-ink-muted text-xs">Senami Social Desk</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col p-5 gap-3.5">
          <div className="flex items-center gap-3">
            <label htmlFor="new-message-to" className="text-ink-secondary w-16 text-xs font-medium">
              To:
            </label>
            <input
              id="new-message-to"
              type="text"
              required
              placeholder="@handle, customer@domain.com or channel profile"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border-line bg-canvas text-ink placeholder:text-ink-subtle h-9 flex-1 rounded-md border px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="new-message-subject" className="text-ink-secondary w-16 text-xs font-medium">
              Subject:
            </label>
            <input
              id="new-message-subject"
              type="text"
              required
              placeholder="Enter subject…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-line bg-canvas text-ink placeholder:text-ink-subtle h-9 flex-1 rounded-md border px-3 text-xs font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-ink-secondary w-16 font-medium">Priority:</span>
              <select
                aria-label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as "normal" | "high" | "urgent")}
                className="border-line bg-canvas text-ink h-8 rounded-md border px-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="normal">Normal Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-ink-secondary font-medium">Queue:</span>
              <select
                aria-label="Queue"
                value={queue}
                onChange={(e) => setQueue(e.target.value)}
                className="border-line bg-canvas text-ink h-8 rounded-md border px-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="Social Desk">Social Desk</option>
                <option value="Card Services">Card Services</option>
                <option value="E-Banking Operations">E-Banking Operations</option>
                <option value="FirstContact Call Center">FirstContact Call Center</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <label htmlFor="new-message-body" className="text-ink-secondary text-xs font-medium">
              Message:
            </label>
            <textarea
              id="new-message-body"
              rows={7}
              placeholder="Type your message here. A professional FirstBank greeting and sign-off will be automatically appended."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="border-line bg-canvas text-ink placeholder:text-ink-subtle resize-none rounded-md border p-3 text-xs leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Quick templates */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-ink-subtle text-[11px]">Templates:</span>
            <button
              type="button"
              onClick={() => {
                setSubject("FirstBank Response: Enquiry Follow-up");
                setBody(
                  "Hi there,\n\nThanks for reaching out to FirstBank. We're pleased to confirm that your enquiry is being reviewed by our team and we'll get back to you shortly.\n\nBest regards,\nOLATUNJI ALAO\nSocial Desk | FirstBank",
                );
              }}
              className="border-line bg-surface-muted text-ink-secondary hover:text-ink hover:bg-surface rounded-md border px-2 py-1 text-[11px] transition-colors"
            >
              Enquiry Acknowledgment
            </button>
            <button
              type="button"
              onClick={() => {
                setSubject("FirstBank Service Update: Card Security Notice");
                setBody(
                  "Hi there,\n\nWe wanted to share an important update regarding your account security.\n\nPlease remember FirstBank will never request your BVN, card PIN, or OTP.\n\nWarm regards,\nFirstBank Response Team",
                );
              }}
              className="border-line bg-surface-muted text-ink-secondary hover:text-ink hover:bg-surface rounded-md border px-2 py-1 text-[11px] transition-colors"
            >
              Security Notice
            </button>
          </div>

          {/* Footer toolbar */}
          <div className="border-line flex items-center justify-between border-t pt-3.5 mt-1">
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                className="border-line text-ink-secondary hover:bg-surface-muted inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
              >
                <Paperclip className="size-3.5" />
                Attach file
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.info("AI draft suggested based on FirstBank standard response tone.");
                  if (!body) {
                    setBody(
                      "Hi there,\n\nThanks for reaching out to FirstBank. We've received your request and our team is actively working on it.\n\nWarm regards,\nOLATUNJI ALAO\nSocial Desk | FirstBank",
                    );
                  }
                }}
                className="border-line text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
              >
                <Sparkles className="size-3.5" />
                AI assist
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-ink-secondary hover:bg-surface-muted rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
              >
                <Send className="size-3.5" />
                {sending ? "Sending…" : "Send message"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
