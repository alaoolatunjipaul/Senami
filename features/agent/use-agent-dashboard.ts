"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import type { AgentDashboardDto } from "@/lib/domain/agent";

/**
 * Agent dashboard data access.
 *
 * A single read of `/api/agent/dashboard`. Everything on the screen - counts,
 * metrics, activity - comes from that one payload, so the tiles can never drift
 * apart from each other or from the inbox behind them.
 */

async function fetchDashboard(): Promise<AgentDashboardDto> {
  const response = await fetch("/api/agent/dashboard");
  if (!response.ok) {
    throw new Error(`Could not load your workspace (${response.status}).`);
  }
  return (await response.json()) as AgentDashboardDto;
}

export function useAgentDashboard() {
  return useQuery({
    queryKey: ["agent", "dashboard"],
    queryFn: fetchDashboard,
  });
}

export function useRefreshDashboard() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/agent/dashboard");
      if (!response.ok) throw new Error(`Could not refresh your workspace (${response.status}).`);
      return (await response.json()) as AgentDashboardDto;
    },
  });
}