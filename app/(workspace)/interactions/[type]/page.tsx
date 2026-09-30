import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Interactions" };

const INTERACTION_LABELS: Record<string, string> = {
  "public-posts": "Public posts",
  comments: "Comments",
  "direct-messages": "Direct messages",
  mentions: "Mentions",
};

export default async function InteractionTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const label = INTERACTION_LABELS[type] ?? "Interactions";

  return (
    <ScopeNotice
      title={label}
      phase="Phase 7"
      description={`The ${label.toLowerCase()} workspace - unified with the inbox while staying true to each platform's content rules - arrives with the social interaction engine.`}
    />
  );
}
