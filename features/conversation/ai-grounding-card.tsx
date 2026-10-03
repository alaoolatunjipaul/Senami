"use client";

import { BookOpen, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  AI_SOURCE_KIND_LABELS,
  CONFIDENCE_BAND_LABELS,
  CONFIDENCE_BAND_TONES,
  type AiGovernanceEnvelope,
} from "@/lib/domain/ai-governance";

/**
 * Grounding and provenance for one assistant draft (Phase 10, 5 and 27).
 *
 * The point of this card is that an agent can answer "why should I trust this?"
 * without leaving the conversation. It shows the state, the band, the sources
 * that back it and what still needs a human - and it shows no reasoning, because
 * the product does not collect any.
 *
 * The confidence band is shown instead of the raw percentage: a number like
 * "73%" implies a calibration we do not have.
 */

export interface AiGroundingCardProps {
  governance: AiGovernanceEnvelope;
}

const STATE_ICON = {
  grounded: ShieldCheck,
  needs_verification: ShieldQuestion,
  low_confidence: ShieldQuestion,
  no_source: ShieldAlert,
  escalation_required: ShieldAlert,
  human_approval_required: ShieldAlert,
} as const;

export function AiGroundingCard({ governance }: AiGroundingCardProps) {
  const Icon = STATE_ICON[governance.state];

  return (
    <section
      aria-label="Grounding and provenance"
      data-testid="ai-grounding"
      className="border-line bg-surface-secondary rounded-md border p-2.5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={governance.tone} size="sm">
          <Icon className="size-3" aria-hidden="true" />
          {governance.stateLabel}
        </Badge>
        <Badge tone={CONFIDENCE_BAND_TONES[governance.band]} size="sm">
          {CONFIDENCE_BAND_LABELS[governance.band]}
        </Badge>
        <Badge tone="neutral" size="sm">
          {governance.riskLabel}
        </Badge>
      </div>

      <p className="text-ink-secondary mt-2 text-[11px] leading-relaxed">
        {governance.guidance}
      </p>

      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex gap-1.5">
          <dt className="text-ink-subtle shrink-0">Model</dt>
          <dd className="text-ink-secondary">{governance.model}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ink-subtle shrink-0">Policy</dt>
          <dd className="text-ink-secondary">
            {governance.mode === "auto" ? "Auto-assisted" : "Assisted"} · v
            {governance.policyVersion}
          </dd>
        </div>
      </dl>

      <div className="mt-2">
        <p className="text-ink-subtle flex items-center gap-1 text-[11px] font-semibold">
          <BookOpen className="size-3" aria-hidden="true" />
          Sources ({governance.sources.length})
        </p>
        {governance.sources.length === 0 ? (
          <p className="text-critical mt-1 text-[11px]">
            Nothing in the knowledge base backs this reply.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {governance.sources.map((source) => (
              <li key={source.id} className="text-ink-secondary text-[11px]">
                <span className="text-ink">{source.title}</span>
                <span className="text-ink-subtle">
                  {" "}
                  · {AI_SOURCE_KIND_LABELS[source.kind]}
                  {source.version ? ` · v${source.version}` : " · unversioned"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {governance.sensitiveData.length > 0 ? (
        <p
          role="status"
          className="border-critical-muted bg-critical-subtle text-critical mt-2 rounded border px-2 py-1 text-[11px]"
        >
          Check before sending: {governance.sensitiveData.map((f) => f.label).join(", ")} detected (
          {governance.sensitiveData.map((f) => f.masked).join(", ")}).
        </p>
      ) : null}

      {governance.requiresApproval ? (
        <p className="border-warning-muted bg-warning-subtle text-warning mt-2 rounded border px-2 py-1 text-[11px]">
          Needs a recorded human approval before it reaches the customer.
        </p>
      ) : null}

      {governance.conditions.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-ink-subtle">
          {governance.conditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}