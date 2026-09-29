import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Surface primitives.
 *
 * Cards are structural only: a bordered surface with an optional header and
 * footer. They deliberately avoid large radii, heavy shadows and decorative
 * padding, because Senami favours dense, scannable operational layouts.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-line bg-surface rounded-lg border shadow-xs", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-ink text-sm font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-ink-muted text-xs", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-line flex items-center gap-2 border-t px-4 py-3", className)}
      {...props}
    />
  );
}
