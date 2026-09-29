import { AlertTriangle, CheckCircle2, Clock, PauseCircle, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  SLA_STATE_LABEL,
  SLA_STATE_TONE,
  type SlaEvaluation,
  type SlaState,
} from "@/lib/domain/sla";
import { cn } from "@/lib/utils";

/**
 * SLA indicator.
 *
 * Renders a computed SLA evaluation (spec section 24). It never accepts a
 * pre-formatted string: the component is given real timestamps and a policy by
 * `evaluateSla`, which keeps every countdown in the product derived from data
 * rather than hard-coded.
 *
 * State is communicated by icon, tone *and* text, so it never depends on colour
 * alone.
 */

const STATE_ICONS: Record<SlaState, LucideIcon> = {
  safe: Clock,
  warning: AlertTriangle,
  breached: XCircle,
  met: CheckCircle2,
  paused: PauseCircle,
};

const STATE_TEXT: Record<SlaState, string> = {
  safe: "text-success",
  warning: "text-warning",
  breached: "text-critical",
  met: "text-success",
  paused: "text-ink-muted",
};

export interface SLAIndicatorProps {
  evaluation: SlaEvaluation;
  /** Hide the countdown and show only the state name (e.g. in dense tables). */
  compact?: boolean;
  className?: string;
}

export function SLAIndicator({ evaluation, compact = false, className }: SLAIndicatorProps) {
  const Icon = STATE_ICONS[evaluation.state];
  const text = STATE_TEXT[evaluation.state];
  const stateName = SLA_STATE_LABEL[evaluation.state];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", text, className)}
      // The precise countdown is always available, even when not visible text.
      title={compact ? `${stateName} - ${evaluation.label}` : undefined}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {compact ? (
        <>
          <span>{stateName}</span>
          <span className="sr-only">
            {evaluation.label}, severity {SLA_STATE_TONE[evaluation.state]}
          </span>
        </>
      ) : (
        <>
          <span data-numeric>{evaluation.label}</span>
          <span className="sr-only">
            {stateName}, severity {SLA_STATE_TONE[evaluation.state]}
          </span>
        </>
      )}
    </span>
  );
}
