"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Query provider for agent-scoped features.
 *
 * Same configuration as the inbox provider, but a separate client so a
 * dashboard query cannot invalidate a conversation query mid-edit. Extracted
 * rather than duplicated: both subtrees want identical caching behaviour.
 */
export function AgentQueryProvider({ children }: { children: ReactNode }) {
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