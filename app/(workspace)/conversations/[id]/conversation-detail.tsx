"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui/states";
import { ConversationWorkspace } from "@/features/conversation/conversation-workspace";

function ConversationPageContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return <LoadingState label="Loading conversation..." />;
  return <ConversationWorkspace conversationId={id} summary={null} now={new Date()} updatingRead={false} onSetRead={() => {}} />;
}

export function ConversationDetail() {
  return (
    <Suspense fallback={<LoadingState label="Loading conversation..." />}>
      <ConversationPageContent />
    </Suspense>
  );
}