"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Query provider for the supervisor console (§26).
 *
 * Scoped to the supervisor subtree for the same reason as the inbox: a supervisor
 * reassigning a conversation must not invalidate an in-progress agent reply.
 *
 * The stale time is deliberately short. A supervisor console is a live operations
 * view, so a figure left on screen for a minute is a figure that can be acted on
 * by mistake.
 */
export function SupervisorProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
