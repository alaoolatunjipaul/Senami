"use client";

import { Drawer } from "@/components/ui/modal";
import { CustomerContextPane } from "@/features/conversation/customer-context-pane";
import type { CustomerContextDto } from "@/lib/domain/customer";

/**
 * Customer context drawer (§8).
 *
 * Customer context opens as an overlay rather than a permanent fourth column, so
 * the conversation keeps the dominant share of the screen at every viewport. It
 * carries the same facts as the standalone column - identity, account metadata,
 * what is still open, and every previous interaction as a real link back into the
 * workspace - read-only, deterministic, and derived from the same records the
 * inbox shows.
 */

export interface CustomerContextPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerContextDto | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Internal conversation id of the interaction currently open. */
  activeConversationId?: string | null;
  /** Open a previous interaction in the workspace. */
  onOpenInteraction?: (conversationId: string) => void;
  /** Open the full customer history drawer. */
  onOpenFullHistory?: () => void;
  now: Date;
}

export function CustomerContextPanel({
  open,
  onOpenChange,
  customer,
  loading,
  error,
  onRetry,
  activeConversationId = null,
  onOpenInteraction,
  onOpenFullHistory,
  now,
}: CustomerContextPanelProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Customer context"
      description={customer ? `${customer.name} · @${customer.handle}` : undefined}
      width="lg"
    >
      <CustomerContextPane
        className="w-full"
        hideHeading
        customer={customer}
        loading={loading}
        error={error}
        onRetry={onRetry}
        activeConversationId={activeConversationId}
        onOpenInteraction={onOpenInteraction ?? (() => undefined)}
        onOpenFullHistory={onOpenFullHistory}
        now={now}
      />
    </Drawer>
  );
}