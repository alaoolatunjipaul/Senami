"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { COMPOSER_MODE_META } from "@/lib/domain/conversation";
import type { ComposerMode } from "@/lib/domain/conversation";

/**
 * Send confirmation (§42).
 *
 * Public and private replies leave the building, so the agent confirms exactly
 * what is about to go out and where it will appear. Internal notes are never
 * confirmed: they cannot reach a customer.
 */

export interface SendConfirmationDialogProps {
  open: boolean;
  mode: ComposerMode;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SendConfirmationDialog({
  open,
  mode,
  body,
  onConfirm,
  onCancel,
}: SendConfirmationDialogProps) {
  const meta = COMPOSER_MODE_META[mode];

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onConfirm() : onCancel())}
      title={`Send ${meta.label.toLowerCase()}?`}
      description={meta.customerFacing ? meta.description : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Keep editing
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Send now
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {meta.customerFacing ? (
            <span className="text-warning inline-flex items-center gap-1 text-xs font-medium">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {mode === "public" ? "Posted publicly to the customer" : "Sent directly to the customer"}
            </span>
          ) : null}
        </div>
        <p className="text-ink-secondary max-h-40 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
          {body}
        </p>
        <p className="text-ink-subtle text-[11px]">
          This cannot be unsent. You can still edit the draft instead of sending.
        </p>
      </div>
    </Modal>
  );
}