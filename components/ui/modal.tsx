"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Modal dialog and side drawer.
 *
 * Both are built on Radix Dialog, which provides the accessibility contract that
 * is easy to get wrong by hand: focus trapping on open, focus restoration on
 * close, escape to dismiss, `aria-modal`, and a focusable close button.
 *
 * `Modal` is centred (confirmations, forms). `Drawer` slides in from the right
 * and is used for customer context, conversation details and filters.
 */

const overlayClasses =
  "fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out";

const contentBase = [
  "fixed z-50 bg-surface shadow-lg",
  "transition-transform duration-normal ease-out-quart",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
].join(" ");

const closeButtonClasses =
  "absolute top-3 right-3 flex size-7 items-center justify-center rounded-sm text-ink-muted " +
  "transition-colors duration-fast hover:bg-surface-muted hover:text-ink";

export interface ModalProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Hide the visible close button when the caller supplies its own actions. */
  hideCloseButton?: boolean;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const modalSizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  hideCloseButton = false,
  footer,
  size = "md",
  className,
  children,
  ...props
}: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClasses} />
        <DialogPrimitive.Content
          className={cn(
            contentBase,
            "top-1/2 left-1/2 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
            "border-line rounded-lg border",
            modalSizes[size],
            className,
          )}
          {...props}
        >
          <div className="border-line border-b px-5 py-3.5 pr-12">
            <DialogPrimitive.Title className="text-ink text-sm font-semibold">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-ink-muted mt-1 text-xs">
                {description}
              </DialogPrimitive.Description>
            ) : (
              // A description is required for screen readers; when the caller
              // omits visible copy, provide an accessible one.
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>

          <div className="px-5 py-4">{children}</div>

          {footer ? (
            <div className="border-line flex items-center justify-end gap-2 border-t px-5 py-3">
              {footer}
            </div>
          ) : null}

          {!hideCloseButton ? (
            <DialogPrimitive.Close className={closeButtonClasses}>
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface DrawerProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "right" | "left" | "bottom";
  width?: "sm" | "md" | "lg";
  footer?: React.ReactNode;
}

const drawerWidths = {
  sm: "w-80",
  md: "w-96",
  lg: "w-[28rem]",
} as const;

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  width = "md",
  footer,
  className,
  children,
  ...props
}: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClasses} />
        <DialogPrimitive.Content
          className={cn(
            contentBase,
            "flex flex-col",
            side === "right" &&
              cn("border-line inset-y-0 right-0 h-full border-l", drawerWidths[width]),
            side === "left" &&
              cn("border-line inset-y-0 left-0 h-full border-r", drawerWidths[width]),
            side === "bottom" &&
              "border-line inset-x-0 bottom-0 max-h-[80vh] rounded-t-xl border-t",
            className,
          )}
          {...props}
        >
          <div className="border-line flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-ink truncate text-sm font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-ink-muted mt-0.5 truncate text-xs">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className={closeButtonClasses}>
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">{children}</div>

          {footer ? (
            <div className="border-line flex items-center justify-end gap-2 border-t px-4 py-3">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
