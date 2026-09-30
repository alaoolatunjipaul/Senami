import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <ScopeNotice
      title="Inbox"
      phase="Phase 6"
      description="The unified social inbox with conversation list, customer awareness, AI draft and reply controls arrives together with the conversation engine."
    />
  );
}
