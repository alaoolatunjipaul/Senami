"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

import { ConversationWorkspace } from "@/features/conversation/conversation-workspace";
import { LoadingState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Conversation" };

function ConversationPageContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return <LoadingState label="Loading conversation..." />;
  return <ConversationWorkspace conversationId={id} summary={null} now={new Date()} updatingRead={false} onSetRead={() => {}} />;
}

export default function ConversationPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading conversation..." />}>
      <ConversationPageContent />
    </Suspense>
  );
}