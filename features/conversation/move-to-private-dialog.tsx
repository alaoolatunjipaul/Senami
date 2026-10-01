"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MESSAGE_BODY_MAX, MOVE_TO_PRIVATE_WARNING } from "@/lib/domain/conversation";

/**
 * Public-to-private confirmation dialog (§3, §8).
 *
 * The warning is shown verbatim and the move cannot be confirmed without a
 * reason. Once confirmed the server creates a linked private conversation and
 * leaves the original public interaction untouched.
 */
export interface MoveToPrivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: string | null;
  onConfirm: (input: { reason: string; greeting: string }) => void;
}

export function MoveToPrivateDialog({
  open,
  onOpenChange,
  pending,
  error,
  onConfirm,
}: MoveToPrivateDialogProps) {
  const [reason, setReason] = useState("");
  const [greeting, setGreeting] = useState("");

  const reasonMissing = reason.trim().length === 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Move to a private message"
      description="Continue this interaction as a direct message."
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm({ reason: reason.trim(), greeting: greeting.trim() })}
            disabled={pending || reasonMissing}
          >
            {pending ? "Moving…" : "Move to private"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="border-warning-muted bg-warning-subtle text-warning flex gap-2 rounded-md border px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{MOVE_TO_PRIVATE_WARNING}</p>
        </div>

        <Field htmlFor="move-reason" label="Reason for moving" required>
          <Input
            id="move-reason"
            value={reason}
            maxLength={300}
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Sharing account-specific details privately"
          />
        </Field>

        <Field
          htmlFor="move-greeting"
          label="First private message"
          description="Optional. Sent to the customer in the new direct message."
        >
          <Textarea
            id="move-greeting"
            value={greeting}
            maxLength={MESSAGE_BODY_MAX}
            disabled={pending}
            onChange={(event) => setGreeting(event.target.value)}
            placeholder="Hi, I'm moving this to a private message to help you securely…"
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
