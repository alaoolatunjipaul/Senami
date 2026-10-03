"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Dropdown menu.
 *
 * Radix supplies the full keyboard contract (arrow keys, type-ahead, escape,
 * focus return). Items are keyboard reachable and expose `role="menuitem"`
 * without any extra work, which is why this is preferred over a bespoke
 * popover menu.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const contentClasses = [
  "z-50 min-w-[11rem] overflow-hidden rounded-md border border-line bg-surface p-1 shadow-md",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
].join(" ");

const itemClasses = [
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
  "text-ink-secondary outline-none transition-colors duration-fast",
  "hover:bg-surface-muted hover:text-ink",
  "focus:bg-surface-muted focus:text-ink",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-muted",
].join(" ");

export function DropdownMenuContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(contentClasses, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        itemClasses,
        destructive && "text-critical hover:bg-critical-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("text-ink-muted px-2 py-1.5 text-xs font-semibold", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("bg-line -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

/** A checkbox-style menu item for multi-select filters. */
export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(
        itemClasses,
        "relative cursor-pointer py-1.5 pr-8 pl-7",
        "data-[highlighted]:bg-surface-muted",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckGlyph />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="text-primary size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6.5 4.5 9 10 3" />
    </svg>
  );
}

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/** A radio-style menu item, for single-choice controls such as appearance. */
export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        itemClasses,
        "relative cursor-pointer py-1.5 pr-8 pl-7",
        "data-[highlighted]:bg-surface-muted",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckGlyph />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export interface DropdownMenuActionProps {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** Convenience wrapper for a plain action row. */
export function DropdownMenuAction({
  label,
  icon,
  onSelect,
  destructive = false,
  disabled = false,
}: DropdownMenuActionProps) {
  return (
    <DropdownMenuItem onSelect={onSelect} destructive={destructive} disabled={disabled}>
      {icon}
      {label}
    </DropdownMenuItem>
  );
}
