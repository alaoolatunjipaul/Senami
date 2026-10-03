"use client";

import { AlertTriangle, Check, Copy, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/modal";
import { AI_ACTIONS, AI_ACTION_META, type AiAction, type AiSuggestionDto } from "@/lib/domain/ai";
import type { AiGovernanceEnvelope } from "@/lib/domain/ai-governance";
import { AiGroundingCard } from "@/features/conversation/ai-grounding-card";

/**
 * AI assistance panel (§8).
 *
 * The assistant drafts, the agent decides. Every action either explains the
 * conversation or produces text the agent adopts into the composer, where it
 * stays fully editable. Nothing here sends anything, and the panel says so in
 * the same words every time rather than relying on the agent to remember.
 */

export interface AiAssistPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current composer draft, used by the rewrite-style actions. */
  draft: string;
  suggestion: AiSuggestionDto | null;
  /** Grounding, provenance and policy facts for the current suggestion. */
  governance: AiGovernanceEnvelope | null;
  pending: boolean;
  error: string | null;
  /** Adopts a draft-producing suggestion into the composer. */
  onAdopt: (content: string) => void;
  onRun: (action: AiAction, input?: string) => void;
}

const DRAFT_ACTIONS: readonly AiAction[] = AI_ACTIONS.filter(
  (action) => AI_ACTION_META[action].producesDraft,
);

export function AiAssistPanel({
  open,
  onOpenChange,
  draft,
  suggestion,
  governance,
  pending,
  error,
  onAdopt,
  onRun,
}: AiAssistPanelProps) {
  const [copied, setCopied] = useState(false);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="AI assistance"
      description="Drafting help. Nothing is sent without you."
      width="sm"
      footer={
        <p className="text-ink-muted text-[11px]">
          Every suggestion is editable. You always send the message yourself.
        </p>
      }
    >
      <div className="space-y-4 p-4">
        <div>
          <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">Understand</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["summarize", "extract_intent", "next_action"] as const).map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onRun(action)}
                title={AI_ACTION_META[action].description}
              >
                {AI_ACTION_META[action].label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">Draft a reply</p>
          <Button
            className="mt-2 w-full"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => onRun("suggest")}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Suggest a response
          </Button>
        </div>

        <div>
          <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
            Improve your draft
          </p>
          <p className="text-ink-subtle mt-1 text-[11px]">
            These rewrite the text in your composer, so write something first.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DRAFT_ACTIONS.filter((action) => action !== "suggest").map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                disabled={pending || draft.trim().length === 0}
                onClick={() => onRun(action, draft)}
                title={AI_ACTION_META[action].description}
              >
                {AI_ACTION_META[action].label}
              </Button>
            ))}
          </div>
        </div>

        {pending ? (
          <div className="text-ink-muted flex items-center gap-2 text-xs" role="status">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            Working on it…
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="border-critical-muted bg-critical-subtle text-critical flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {suggestion ? (
          <section
            aria-label="AI suggestion"
            data-testid="ai-suggestion"
            className="border-ai-muted bg-ai-subtle rounded-md border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-ai flex items-center gap-1.5 text-xs font-semibold">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {suggestion.title}
              </p>
              <Badge tone="ai" size="sm">
                {AI_ACTION_META[suggestion.action].label}
              </Badge>
            </div>
            <p className="text-ink-secondary mt-2 text-xs leading-relaxed whitespace-pre-wrap">
              {suggestion.content}
            </p>
            <p className="text-ink-subtle mt-2 text-[11px]">
              Draft only · editable · not sent
            </p>
            {governance ? <AiGroundingCard governance={governance} /> : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {AI_ACTION_META[suggestion.action].producesDraft ? (
                <Button size="sm" onClick={() => onAdopt(suggestion.content)}>
                  <Check className="size-3.5" aria-hidden="true" />
                  Use in composer
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(suggestion.content);
                  setCopied(true);
                }}
              >
                <Copy className="size-3.5" aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}