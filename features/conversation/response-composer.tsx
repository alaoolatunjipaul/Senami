"use client";

import { AlertTriangle, Paperclip, Send, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COMPOSER_MODES,
  COMPOSER_MODE_META,
  COMPOSER_MODE_TO_KIND,
  MESSAGE_BODY_MAX,
  MOCK_ATTACHMENTS,
  attachmentKindOf,
  draftHasContent,
  emptyDraft,
  formatFileSize,
  validateMessageBody,
  type ComposerMode,
  type MessageAttachment,
  type MessageDraft,
} from "@/lib/domain/conversation";
import { cn } from "@/lib/utils";

/**
 * Response composer.
 *
 * One composer, three honest modes (§8): Public Reply, Private Reply and
 * Internal Note. Drafts are preserved per mode, so switching to write a private
 * note never destroys an in-progress public reply. Internal notes are styled
 * distinctly and the mode description states plainly that they are never sent to
 * the customer.
 *
 * Attachments are mock metadata only: nothing is uploaded and no object URL is
 * created (§47).
 */

export interface ComposerSendVariables {
  kind: "public" | "private" | "internal_note";
  body: string;
  attachments: readonly MessageAttachment[];
}

export interface ResponseComposerProps {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  /** Resolves on success, rejects with the server's message on failure. */
  onSend: (variables: ComposerSendVariables) => Promise<unknown>;
  /** Whether the signed-in role may send customer-facing replies and notes. */
  allowed: boolean;
}

export function ResponseComposer({ mode, onModeChange, onSend, allowed }: ResponseComposerProps) {
  const [drafts, setDrafts] = useState<Record<ComposerMode, MessageDraft>>(() => ({
    public: emptyDraft("public"),
    private: emptyDraft("private"),
    internal_note: emptyDraft("internal_note"),
  }));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ComposerSendVariables | null>(null);

  const draft = drafts[mode];
  const meta = COMPOSER_MODE_META[mode];
  const validation = validateMessageBody(draft.body);
  const canSend = allowed && !sending && draftHasContent(draft) && validation.valid;

  function patchDraft(patch: Partial<MessageDraft>) {
    setDrafts((previous) => ({ ...previous, [mode]: { ...previous[mode], ...patch } }));
  }

  function addAttachment(attachment: MessageAttachment) {
    if (draft.attachments.some((existing) => existing.name === attachment.name)) return;
    patchDraft({ attachments: [...draft.attachments, attachment] });
  }

  function removeAttachment(id: string) {
    patchDraft({ attachments: draft.attachments.filter((attachment) => attachment.id !== id) });
  }

  async function submit(variables: ComposerSendVariables) {
    setSending(true);
    setError(null);
    setAttempt(variables);
    try {
      await onSend(variables);
      setDrafts((previous) => ({
        ...previous,
        [mode]: { ...previous[mode], body: "", attachments: [] },
      }));
      setAttempt(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    if (!canSend) {
      if (draft.body.trim() === "" && !draftHasContent(draft)) {
        setError("Write a message before sending.");
      } else if (!validation.valid) {
        setError(validation.message ?? null);
      }
      return;
    }
    void submit({
      kind: COMPOSER_MODE_TO_KIND[mode],
      body: draft.body.trim(),
      attachments: draft.attachments,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <section
      aria-label="Response composer"
      className="border-line bg-surface shrink-0 border-t"
    >
      <Tabs value={mode} onValueChange={(value) => onModeChange(value as ComposerMode)}>
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <TabsList className="border-b-0">
            {COMPOSER_MODES.map((candidate) => (
              <TabsTrigger key={candidate} value={candidate}>
                {COMPOSER_MODE_META[candidate].label}
              </TabsTrigger>
            ))}
          </TabsList>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!allowed}>
                <Paperclip className="size-3.5" aria-hidden="true" />
                Attach
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mock attachments</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MOCK_ATTACHMENTS.map((sample) => (
                <DropdownMenuItem
                  key={sample.name}
                  disabled={draft.attachments.some((attachment) => attachment.name === sample.name)}
                  onSelect={() =>
                    addAttachment({
                      ...sample,
                      id: `att-${draft.attachments.length}-${sample.name}`,
                      kind: attachmentKindOf(sample.mimeType),
                    })
                  }
                >
                  {sample.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2 px-3 pt-2 pb-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-ink-muted text-xs">{meta.description}</p>
            {meta.customerFacing && mode === "public" ? (
              <p className="text-warning text-[11px] font-medium">
                Visible publicly on the social platform.
              </p>
            ) : null}
          </div>

          <label htmlFor="composer-body" className="sr-only">
            {meta.label} message
          </label>
          <Textarea
            id="composer-body"
            value={draft.body}
            disabled={!allowed || sending}
            invalid={error !== null && !validation.valid}
            placeholder={placeholderFor(mode)}
            maxLength={MESSAGE_BODY_MAX + 1}
            onChange={(event) => patchDraft({ body: event.target.value })}
            onKeyDown={handleKeyDown}
            className={cn(mode === "internal_note" && "border-warning-muted bg-warning-subtle")}
          />

          {draft.attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Attachments">
              {draft.attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="border-line bg-canvas text-ink-secondary flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs"
                >
                  <span className="truncate">{attachment.name}</span>
                  <span className="text-ink-subtle" data-numeric>
                    {formatFileSize(attachment.sizeBytes)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name}`}
                    className="text-ink-muted hover:text-ink"
                    onClick={() => removeAttachment(attachment.id)}
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="border-critical-muted bg-critical-subtle text-critical flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
            >
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{error}</span>
              {attempt ? (
                <Button variant="ghost" size="sm" onClick={() => void submit(attempt)}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="text-ink-subtle text-[11px]" data-numeric>
              {draft.body.trim().length} / {MESSAGE_BODY_MAX}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-ink-subtle hidden text-[11px] sm:inline">
                Ctrl/⌘ + Enter to send
              </span>
              <Button size="sm" onClick={handleSend} disabled={!canSend}>
                <Send className="size-3.5" aria-hidden="true" />
                {sending ? "Sending…" : `Send ${meta.label.toLowerCase()}`}
              </Button>
            </div>
          </div>

          {!allowed ? (
            <p className="text-ink-muted text-xs">
              Your role can view this conversation but cannot send replies.
            </p>
          ) : null}
        </div>
      </Tabs>
    </section>
  );
}

function placeholderFor(mode: ComposerMode): string {
  if (mode === "internal_note") return "Write an internal note for your team…";
  if (mode === "private") return "Write a private reply to the customer…";
  return "Write a public reply…";
}
