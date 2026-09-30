import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";
import { channelLabel } from "@/lib/domain/channel-visuals";

export const metadata: Metadata = { title: "Channel" };

export default async function ChannelPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  const label = channelLabel(channel);

  return (
    <ScopeNotice
      title={label}
      phase="Phase 6"
      description={`The ${label} workspace - accounts, unread activity, content calendar and channel health - arrives with the social gateway.`}
    />
  );
}
