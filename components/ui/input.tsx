"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Form primitives.
 *
 * `Field` wires a label, optional description and error message together with
 * the `aria-describedby` / `aria-invalid` relationships that make a form
 * usable with a screen reader. The error is rendered in a `role="alert"` so it
 * is announced when validation fails.
 */

const controlClasses = [
  "w-full rounded-md border bg-surface text-sm text-ink",
  "placeholder:text-ink-subtle",
  "transition-colors duration-fast",
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted",
].join(" ");

const stateClasses = (invalid?: boolean) =>
  invalid
    ? "border-critical focus-visible:outline-critical"
    : "border-line-strong hover:border-line-strongest focus-visible:outline-primary";

export function Input({
  className,
  invalid,
  ...props
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, stateClasses(invalid), "h-9 px-3", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, stateClasses(invalid), "min-h-20 px-3 py-2", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, stateClasses(invalid), "h-9 pr-8 pl-3", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-ink-secondary text-xs font-medium", className)}
      {...props}
    />
  );
}

export interface FieldProps {
  /** Must match the `id` of the control this field describes. */
  htmlFor: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  htmlFor,
  label,
  description,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const descriptionId = description ? `${htmlFor}-description` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="text-critical ml-0.5">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </Label>
      </div>

      {description ? (
        <p id={descriptionId} className="text-ink-muted text-xs">
          {description}
        </p>
      ) : null}

      {children}

      {error ? (
        <p id={errorId} role="alert" className="text-critical text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Props helper so controls can be linked to their Field programmatically. */
export function fieldAriaProps(
  fieldId: string,
  options: { description?: string; error?: string },
): { "aria-describedby"?: string; invalid?: boolean } {
  const ids = [
    options.description ? `${fieldId}-description` : null,
    options.error ? `${fieldId}-error` : null,
  ]
    .filter((id): id is string => id !== null)
    .join(" ");

  return {
    ...(ids ? { "aria-describedby": ids } : {}),
    ...(options.error ? { invalid: true } : {}),
  };
}
