"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Query provider for the inbox.
 *
 * Scoped to the inbox subtree rather than the whole app so Phase 6 introduces
 * TanStack Query without changing global layout behaviour. A stale time keeps
 * tab switching snappy while mutations still refetch on invalidation.
 */
export function InboxProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}