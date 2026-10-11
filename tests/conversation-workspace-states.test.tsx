import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationMessageDto } from "@/lib/domain/conversation";
import type { InboxConversationDto } from "@/lib/domain/inbox";
import type { Session } from "@/lib/domain/user";

const state = vi.hoisted(() => {
  const refetch = () => undefined;
  return {
    detail: { data: undefined, isLoading: false, isError: false, isFetching: false, refetch } as Record<
      string,
      unknown
    >,
    messages: { data: { messages: [] }, isLoading: false, isError: false, isFetching: false, refetch } as Record<
      string,
      unknown
    >,
    audit: { data: { events: [] }, isLoading: false, isError: false, isFetching: false, refetch },
    history: { data: null, isLoading: false, isError: false, isFetching: false, refetch },
    customerContext: { data: null, isLoading: false, isError: false, isFetching: false, refetch },
    mutation: {
      mutate: () => undefined,
      mutateAsync: async () => ({}),
      isPending: false,
      isError: false,
      error: null,
    },
  };
});

vi.mock("@/features/conversation/use-conversation", () => ({
  useConversationDetail: () => state.detail,
  useConversationMessages: () => state.messages,
  useConversationAudit: () => state.audit,
  useCustomerHistory: () => state.history,
  useCustomerContext: () => state.customerContext,
  useSendMessage: () => state.mutation,
  useAssignConversation: () => state.mutation,
  useEscalateConversation: () => state.mutation,
  useMoveToPrivate: () => state.mutation,
  useAiSuggestion: () => state.mutation,
  useRecordDraftEdit: () => state.mutation,
  useConversationStatus: () => state.mutation,
  useRecordOpen: () => state.mutation,
  useNow: () => new Date("2026-05-20T12:00:00.000Z"),
}));

import { ConversationWorkspace } from "@/features/conversation/conversation-workspace";
import { SessionProvider } from "@/features/shell/session-context";

const NOW = new Date("2026-05-20T12:00:00.000Z");

const SESSION: Session = {
  id: "session-1",
  user: {
    id: "usr_agent_maya",
    name: "Maya Keller",
    email: "maya@senami.example",
    role: "AGENT",
    teamId: null,
    initials: "MK",
  },
  expiresAt: NOW.getTime() + 3_600_000,
};

function dto(): InboxConversationDto {
  return {
    id: "cv_0001",
    channel: "instagram",
    customer: { id: "cus_1", name: "Maya Keller", handle: "@maya_keller" },
    receivedAt: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
    lastMessageAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    respondedAt: null,
    preview: "My card was declined",
    intent: "card_issue",
    sentiment: "frustrated",
    priority: "high",
    status: "open",
    slaPaused: false,
    needsReview: false,
    assignedTo: null,
    unread: true,
  };
}

function message(): ConversationMessageDto {
  return {
    id: "cv_0001-m00",
    conversationId: "cv_0001",
    kind: "public",
    direction: "inbound",
    author: { id: "cus_1", name: "Maya Keller", type: "customer" },
    body: "My card was declined",
    createdAt: NOW.toISOString(),
    attachments: [],
    replyToId: null,
    aiConfidence: null,
  };
}

function renderWorkspace(conversationId: string | null = "cv_0001") {
  return render(
    <SessionProvider session={SESSION}>
      <ConversationWorkspace
        conversationId={conversationId}
        summary={null}
        now={NOW}
        updatingRead={false}
        onSetRead={() => undefined}
      />
    </SessionProvider>,
  );
}

beforeEach(() => {
  state.detail = { data: undefined, isLoading: false, isError: false, isFetching: false, refetch: () => undefined };
  state.messages = {
    data: { messages: [] },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: () => undefined,
  };
});

describe("ConversationWorkspace states", () => {
  it("prompts for a selection when nothing is chosen", () => {
    renderWorkspace(null);
    expect(screen.getByText("No conversation selected")).toBeInTheDocument();
  });

  it("shows a loading state while the conversation is fetched", () => {
    state.detail = { data: undefined, isLoading: true, isError: false, isFetching: true, refetch: () => undefined };
    renderWorkspace();
    expect(screen.getByText("Loading conversation…")).toBeInTheDocument();
  });

  it("shows an error state with a retry when the conversation fails to load", () => {
    state.detail = { data: undefined, isLoading: false, isError: true, isFetching: false, refetch: () => undefined };
    renderWorkspace();
    expect(screen.getByText("Conversation unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders the header, timeline and composer once loaded", () => {
    state.detail = {
      data: {
        conversation: dto(),
        thread: {
          type: "public",
          originConversationId: null,
          movedToConversationId: null,
          assignees: [],
        },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: () => undefined,
    };
    state.messages = {
      data: { messages: [message()] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: () => undefined,
    };

    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Maya Keller" })).toBeInTheDocument();
    expect(screen.getAllByText("My card was declined").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "Public Reply" })).toBeInTheDocument();
  });
});
