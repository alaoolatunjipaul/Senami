import type { Metadata } from "next";

import { ConversationDetail } from "./conversation-detail";

export const metadata: Metadata = { title: "Conversation" };

export default function ConversationPage() {
  return <ConversationDetail />;
}