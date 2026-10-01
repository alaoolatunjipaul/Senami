import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageTimeline } from "@/features/conversation/message-timeline";
import { MESSAGE_KIND_META, type MessageKind } from "@/lib/domain/taxonomy";
import type { ConversationMessageDto } from "@/lib/domain/conversation";

const NOW = new Date("2026-05-20T12:00:00.000Z");

function message(
  kind: MessageKind,
  overrides: Partial<ConversationMessageDto> = {},
): ConversationMessageDto {
  return {
    id: `m-${kind}`,
    conversationId: "cv_0001",
    kind,
    direction: kind === "public" || kind === "internal_note" ? "outbound" : "inbound",
    author: { id: "usr_agent_maya", name: "Maya Keller", type: "agent", role: "AGENT" },
    body: `Body for ${kind}`,
    createdAt: NOW.toISOString(),
    attachments: [],
    replyToId: null,
    aiConfidence: null,
    ...overrides,
  };
}

describe("MessageTimeline", () => {
  it("shows a distinct label for every message kind", () => {
    render(
      <MessageTimeline
        now={NOW}
        messages={[
          message("public"),
          message("private"),
          message("internal_note"),
          message("ai_generated", { author: { id: "ai", name: "Senami AI", type: "ai" }, aiConfidence: 0.82 }),
        ]}
      />,
    );

    expect(screen.getByText(MESSAGE_KIND_META.public.label)).toBeInTheDocument();
    expect(screen.getByText(MESSAGE_KIND_META.private.label)).toBeInTheDocument();
    expect(screen.getByText(MESSAGE_KIND_META.internal_note.label)).toBeInTheDocument();
    expect(screen.getByText(MESSAGE_KIND_META.ai_generated.label)).toBeInTheDocument();
    expect(screen.getByText("82% confidence")).toBeInTheDocument();
  });

  it("renders system events and internal notes with their bodies", () => {
    render(
      <MessageTimeline
        now={NOW}
        messages={[
          message("system", { body: "Conversation created", direction: "outbound" }),
          message("internal_note", { body: "Checking the transaction log." }),
        ]}
      />,
    );

    expect(screen.getByText(/Conversation created/)).toBeInTheDocument();
    expect(screen.getByText("Checking the transaction log.")).toBeInTheDocument();
  });

  it("renders attachment metadata", () => {
    render(
      <MessageTimeline
        now={NOW}
        messages={[
          message("public", {
            attachments: [
              {
                id: "att-1",
                name: "statement.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1_048_576,
                url: "/demo/statement.pdf",
                kind: "document",
              },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText("statement.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
  });

  it("shows an empty state when there are no messages", () => {
    render(<MessageTimeline now={NOW} messages={[]} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});
