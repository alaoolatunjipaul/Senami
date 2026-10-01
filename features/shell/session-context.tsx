"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Session } from "@/lib/domain/user";

/**
 * Client session context.
 *
 * The workspace layout already resolves the session on the server. This context
 * hands the same, already-authorised session to client components so the
 * conversation workspace can gate actions without a second round trip. It is a
 * convenience only: every mutation is re-authorised on the server (§29).
 */

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used within a SessionProvider.");
  }
  return session;
}
