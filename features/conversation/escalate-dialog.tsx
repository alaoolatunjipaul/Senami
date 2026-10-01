"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  ESCALATION_NOTE_MAX,
  ESCALATION_REASONS,
  ESCALATION_REASON_LABELS,
  type EscalationReason,
} from "@/lib/domain/conversation";

/**
 * Escalation dialog (§8).
 *
 * An escalation must carry a reason so a supervisor can triage it. The optional
 * note is recorded as an internal note and in the audit trail - it is never
 * shown to the customer.
 */
export interface EscalateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: string | null;
  onEscalate: (input: { reason: EscalationReason; note: string }) => void;
}

export function EscalateDialog({
  open,
  onOpenChange,
  pending,
  error,
  onEscalate,
}: EscalateDialogProps) {
  const [reason, setReason] = useState<EscalationReason>("complex_case");
  const [note, setNote] = useState("");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Escalate conversation"
      description="Route this conversation to a supervisor for review."
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onEscalate({ reason, note: note.trim() })}
            disabled={pending}
          >
            {pending ? "Escalating…" : "Escalate"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field htmlFor="escalation-reason" label="Reason" required>
          <Select
            id="escalation-reason"
            value={reason}
            disabled={pending}
            onChange={(event) => setReason(event.target.value as EscalationReason)}
          >
            {ESCALATION_REASONS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {ESCALATION_REASON_LABELS[candidate]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          htmlFor="escalation-note"
          label="Internal note"
          description={`Optional context for the supervisor. Never sent to the customer. (${ESCALATION_NOTE_MAX} characters max)`}
        >
          <Textarea
            id="escalation-note"
            value={note}
            maxLength={ESCALATION_NOTE_MAX}
            disabled={pending}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Summarise what the supervisor needs to know…"
            className="border-warning-muted bg-warning-subtle"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-critical text-xs">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
