"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RESOLVE_CONFIRMATION, RESOLVE_NOTE_MAX } from "@/lib/domain/conversation";

/**
 * Resolve dialog (§8, §42).
 *
 * Resolving is the one irreversible action in the workspace, so it is confirmed
 * explicitly and the confirmation states what happens to the thread. The note is
 * recorded in the audit trail; it is never sent to the customer.
 */
export interface ResolveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: string | null;
  onResolve: (note: string) => void;
  onReopen: () => void;
  /** True when the conversation is already resolved, so the dialog reopens it. */
  alreadyResolved: boolean;
}

export function ResolveDialog({
  open,
  onOpenChange,
  pending,
  error,
  onResolve,
  onReopen,
  alreadyResolved,
}: ResolveDialogProps) {
  const [note, setNote] = useState("");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={alreadyResolved ? "Reopen conversation" : "Resolve conversation"}
      description={
        alreadyResolved
          ? "Reopening puts the conversation back in the active queue."
          : "Resolving clears this conversation from your active queue."
      }
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          {alreadyResolved ? (
            <Button size="sm" disabled={pending} onClick={onReopen}>
              {pending ? "Reopening…" : "Reopen"}
            </Button>
          ) : (
            <Button size="sm" disabled={pending} onClick={() => onResolve(note.trim())}>
              {pending ? "Resolving…" : "Resolve conversation"}
            </Button>
          )}
        </>
      }
    >
      {alreadyResolved ? (
        <p className="text-ink-secondary text-sm">
          The conversation returns to the queue with the same messages and audit trail.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="border-warning-muted bg-warning-subtle text-warning rounded-md border px-3 py-2 text-xs">
            {RESOLVE_CONFIRMATION}
          </p>
          <Field
            htmlFor="resolve-note"
            label="Resolution note"
            description="Recorded in the audit trail only."
          >
            <Textarea
              id="resolve-note"
              value={note}
              disabled={pending}
              maxLength={RESOLVE_NOTE_MAX + 1}
              placeholder="What was the outcome?"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-critical text-xs">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}