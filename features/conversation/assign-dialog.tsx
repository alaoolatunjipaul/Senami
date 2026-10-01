"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { InboxAssignee, InboxConversationDto } from "@/lib/domain/inbox";
import { cn } from "@/lib/utils";

/**
 * Assign / reassign dialog (§8).
 *
 * The current owner is preselected. Unassigning is first-class rather than a
 * hidden trick. The server re-checks the assignment policy, so an agent who is
 * not permitted to take over another agent's conversation is rejected even if
 * they somehow reach this dialog.
 */
export interface AssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: InboxConversationDto;
  assignees: readonly InboxAssignee[];
  pending: boolean;
  error: string | null;
  onAssign: (assigneeId: string | null) => void;
}

export function AssignDialog({
  open,
  onOpenChange,
  conversation,
  assignees,
  pending,
  error,
  onAssign,
}: AssignDialogProps) {
  const [selected, setSelected] = useState<string | null>(conversation.assignedTo?.id ?? null);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Assign conversation"
      description="Choose the agent who should own this conversation."
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onAssign(selected)} disabled={pending}>
            {pending ? "Saving…" : "Assign"}
          </Button>
        </>
      }
    >
      <fieldset disabled={pending} className="space-y-1">
        <legend className="sr-only">Assignee</legend>

        <AssignOption
          id="assignee-none"
          name="assignee"
          checked={selected === null}
          onSelect={() => setSelected(null)}
          title="Unassigned"
          subtitle="Leave in the shared queue"
        />

        {assignees.map((assignee) => (
          <AssignOption
            key={assignee.id}
            id={`assignee-${assignee.id}`}
            name="assignee"
            checked={selected === assignee.id}
            onSelect={() => setSelected(assignee.id)}
            title={assignee.name}
            subtitle={assignee.teamName}
          />
        ))}
      </fieldset>

      {error ? (
        <p role="alert" className="text-critical mt-3 text-xs">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

function AssignOption({
  id,
  name,
  checked,
  onSelect,
  title,
  subtitle,
}: {
  id: string;
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors duration-fast",
        checked ? "border-primary bg-primary-subtle" : "border-line hover:bg-surface-muted",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="accent-primary"
      />
      <span className="min-w-0">
        <span className="text-ink block truncate text-sm">{title}</span>
        <span className="text-ink-muted block truncate text-xs">{subtitle}</span>
      </span>
    </label>
  );
}
