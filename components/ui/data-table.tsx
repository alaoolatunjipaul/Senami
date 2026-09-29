import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/**
 * Data table.
 *
 * A single, honest table primitive that owns the four states every data view
 * needs: loading, error, empty and loaded (spec sections 32, 44). Callers
 * supply columns; they never re-implement skeletons or error panels.
 *
 * Rendering is a real `<table>` with a caption, so row/column relationships are
 * exposed to assistive technology. Sorting and row actions are wired by the
 * caller through the `cell` renderers.
 */

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  /** Accessible header text when the visible header is abbreviated or icon-only. */
  srHeader?: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /** Right-align numeric columns. */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /** Required: an unlabelled table is not accessible. */
  caption: string;
  loading?: boolean;
  error?: { requestId?: string } | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  className?: string;
  skeletonRows?: number;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "Nothing to show",
  emptyDescription,
  emptyAction,
  className,
  skeletonRows = 8,
}: DataTableProps<T>) {
  const colSpan = Math.max(columns.length, 1);

  const body = (() => {
    if (loading) {
      return Array.from({ length: skeletonRows }, (_, rowIndex) => (
        <tr key={`skeleton-${rowIndex}`} className="border-line border-b last:border-b-0">
          {columns.map((column) => (
            <td key={column.id} className={cn("px-3 py-2.5", column.className)}>
              <Skeleton className="h-3.5 w-full max-w-32" />
            </td>
          ))}
        </tr>
      ));
    }

    if (error) {
      return (
        <tr>
          <td colSpan={colSpan} className="p-0">
            <ErrorState
              title="Unable to load data"
              description="We couldn't load this list. The problem has been logged."
              requestId={error.requestId}
              onRetry={onRetry}
            />
          </td>
        </tr>
      );
    }

    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={colSpan} className="p-0">
            <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
          </td>
        </tr>
      );
    }

    return rows.map((row) => (
      <tr
        key={getRowKey(row)}
        className="border-line hover:bg-canvas-subtle border-b last:border-b-0"
      >
        {columns.map((column) => (
          <td
            key={column.id}
            className={cn("text-ink-secondary px-3 py-2.5 text-sm", column.className)}
          >
            {column.cell(row)}
          </td>
        ))}
      </tr>
    ));
  })();

  return (
    <div className={cn("scrollbar-slim w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-line bg-canvas-subtle border-b">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "text-ink-muted px-3 py-2 text-xs font-semibold",
                  column.numeric && "text-right",
                  column.headerClassName,
                )}
              >
                {column.srHeader ? <span className="sr-only">{column.srHeader}</span> : null}
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={loading || undefined}>{body}</tbody>
      </table>
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Server-side pagination control (spec section 43). */
export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-3 px-3 py-2 text-xs", className)}
    >
      <p className="text-ink-muted" data-numeric>
        {first}-{last} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="text-ink-muted px-1" data-numeric>
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
