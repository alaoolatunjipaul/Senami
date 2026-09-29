import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Button.
 *
 * The only sanctioned way to trigger an action. Variants encode intent
 * (primary/secondary/outline/ghost/danger) rather than colour, so the palette
 * stays small and consistent.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md border font-medium",
    "transition-colors duration-fast ease-out-quart",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-primary text-ink-inverse hover:bg-primary-hover active:bg-primary-active",
        secondary: "border-transparent bg-surface-muted text-ink hover:bg-surface-hover",
        outline: "border-line-strong bg-surface text-ink hover:bg-surface-muted",
        ghost:
          "border-transparent bg-transparent text-ink-secondary hover:bg-surface-muted hover:text-ink",
        danger: "border-transparent bg-critical text-ink-inverse hover:bg-critical-hover",
        link: "h-auto border-transparent bg-transparent p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-2.5 text-xs [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-sm [&_svg]:size-4",
        lg: "h-10 px-4 text-sm [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-3.5",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `<button>` (e.g. a `<Link>`). */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      // Buttons inside forms default to `submit`, which causes accidental
      // submissions. `type` is only injected for real buttons, never for Slots.
      {...(asChild ? {} : { type })}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}
