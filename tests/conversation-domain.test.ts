import { describe, expect, it } from "vitest";

import {
  COMPOSER_MODES,
  COMPOSER_MODE_META,
  COMPOSER_MODE_TO_KIND,
  MOVE_TO_PRIVATE_WARNING,
  attachmentKindOf,
  composerModeForKind,
  draftHasContent,
  emptyDraft,
  formatFileSize,
  isAiMessage,
  isCustomerFacing,
  isInternalMessage,
  isSystemMessage,
  summariseEscalation,
  toAuditEventDto,
  toConversationMessageDto,
  toCustomerHistoryDto,
  validateMessageBody,
  type ConversationMessage,
} from "@/lib/domain/conversation";

describe("validateMessageBody", () => {
  it("rejects empty and whitespace-only bodies", () => {
    expect(validateMessageBody("").valid).toBe(false);
    expect(validateMessageBody("    ").valid).toBe(false);
    expect(validateMessageBody("").message).toBeTruthy();
  });

  it("accepts a normal body and the exact maximum", () => {
    expect(validateMessageBody("Thanks for your patience.").valid).toBe(true);
    expect(validateMessageBody("x".repeat(2000)).valid).toBe(true);
  });

  it("rejects a body over the maximum", () => {
    const result = validateMessageBody("x".repeat(2001));
    expect(result.valid).toBe(false);
    expect(result.message).toContain("2000");
  });
});

describe("message kind rules", () => {
  it("only treats public and private kinds as customer-facing", () => {
    expect(isCustomerFacing("public")).toBe(true);
    expect(isCustomerFacing("private")).toBe(true);
    expect(isCustomerFacing("internal_note")).toBe(false);
    expect(isCustomerFacing("ai_generated")).toBe(false);
    expect(isCustomerFacing("system")).toBe(false);
  });

  it("flags internal notes, system events and AI content", () => {
    expect(isInternalMessage("internal_note")).toBe(true);
    expect(isInternalMessage("public")).toBe(false);
    expect(isSystemMessage("system")).toBe(true);
    expect(isAiMessage("ai_generated")).toBe(true);
  });
});

describe("composer vocabulary", () => {
  it("maps composer modes to the message kinds the API accepts", () => {
    for (const mode of COMPOSER_MODES) {
      expect(COMPOSER_MODE_TO_KIND[mode]).toBe(mode);
    }
  });

  it("round-trips a writable kind to its composer mode", () => {
    expect(composerModeForKind("public")).toBe("public");
    expect(composerModeForKind("private")).toBe("private");
    expect(composerModeForKind("internal_note")).toBe("internal_note");
    expect(composerModeForKind("ai_generated")).toBeNull();
    expect(composerModeForKind("system")).toBeNull();
  });

  it("labels the modes and marks which are customer facing", () => {
    expect(COMPOSER_MODE_META.public.label).toBe("Public Reply");
    expect(COMPOSER_MODE_META.private.label).toBe("Private Reply");
    expect(COMPOSER_MODE_META.internal_note.label).toBe("Internal Note");
    expect(COMPOSER_MODE_META.internal_note.customerFacing).toBe(false);
    expect(COMPOSER_MODE_META.public.customerFacing).toBe(true);
  });
});

describe("drafts", () => {
  it("starts empty and reports whether it has content", () => {
    const draft = emptyDraft("private");
    expect(draft).toEqual({ mode: "private", body: "", attachments: [] });
    expect(draftHasContent(draft)).toBe(false);
    expect(draftHasContent({ ...draft, body: "hi" })).toBe(true);
    expect(
      draftHasContent({
        ...draft,
        attachments: [
          { id: "a", name: "x.png", mimeType: "image/png", sizeBytes: 1, url: "/x", kind: "image" },
        ],
      }),
    ).toBe(true);
  });
});

describe("attachments", () => {
  it("classifies MIME types into attachment kinds", () => {
    expect(attachmentKindOf("image/png")).toBe("image");
    expect(attachmentKindOf("image/jpeg")).toBe("image");
    expect(attachmentKindOf("video/mp4")).toBe("video");
    expect(attachmentKindOf("audio/mpeg")).toBe("audio");
    expect(attachmentKindOf("application/pdf")).toBe("document");
    expect(attachmentKindOf("application/zip")).toBe("other");
  });

  it("formats byte sizes for display", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1_048_576)).toBe("1.0 MB");
  });
});

describe("DTO mapping", () => {
  const base: ConversationMessage = {
    id: "cv_0001-m00",
    conversationId: "cv_0001",
    kind: "internal_note",
    direction: "outbound",
    author: { id: "usr_agent_maya", name: "Maya Keller", type: "agent", role: "AGENT" },
    body: "Checking with payments.",
    createdAt: new Date("2026-05-20T12:00:00.000Z"),
    attachments: [],
    replyToId: null,
    aiConfidence: null,
  };

  it("serialises a message's dates and null defaults", () => {
    const dto = toConversationMessageDto(base);
    expect(dto.createdAt).toBe("2026-05-20T12:00:00.000Z");
    expect(dto.replyToId).toBeNull();
    expect(dto.aiConfidence).toBeNull();
    expect(dto.kind).toBe("internal_note");
  });

  it("serialises an audit event", () => {
    const dto = toAuditEventDto({
      id: "evt",
      conversationId: "cv_0001",
      type: "escalated",
      summary: "Escalated",
      actor: "Maya Keller",
      createdAt: new Date("2026-05-20T12:00:00.000Z"),
      metadata: { reason: "complex_case" },
    });
    expect(dto.createdAt).toBe("2026-05-20T12:00:00.000Z");
    expect(dto.metadata).toEqual({ reason: "complex_case" });
  });

  it("serialises customer history including nested conversation dates", () => {
    const dto = toCustomerHistoryDto({
      customer: { id: "cus_1", name: "Maya Keller", handle: "@maya" },
      totalConversations: 3,
      openConversations: 1,
      resolvedConversations: 2,
      firstContactAt: new Date("2026-01-01T00:00:00.000Z"),
      lastContactAt: new Date("2026-05-20T12:00:00.000Z"),
      recent: [
        {
          id: "cv_0001",
          interactionId: "INT-SOC-20260520-00042",
          channel: "instagram",
          intent: "card_issue",
          status: "resolved",
          priority: "high",
          preview: "Card declined",
          receivedAt: new Date("2026-05-20T09:00:00.000Z"),
          lastMessageAt: new Date("2026-05-20T12:00:00.000Z"),
          assignedTo: {
            id: "agt_1",
            name: "Ana Ruiz",
            teamId: "team_1",
            teamName: "Payments",
          },
        },
      ],
    });
    expect(dto.totalConversations).toBe(3);
    expect(dto.lastContactAt).toBe("2026-05-20T12:00:00.000Z");
    expect(dto.recent[0]?.lastMessageAt).toBe("2026-05-20T12:00:00.000Z");
    expect(dto.recent[0]?.interactionId).toBe("INT-SOC-20260520-00042");
    expect(dto.recent[0]?.receivedAt).toBe("2026-05-20T09:00:00.000Z");
    expect(dto.recent[0]?.assignedTo?.name).toBe("Ana Ruiz");
  });
});

describe("escalation and public-to-private copy", () => {
  it("summarises an escalation with the reason label", () => {
    expect(summariseEscalation("fraud_risk")).toContain("Fraud or security risk");
  });

  it("warns that the public interaction is preserved", () => {
    expect(MOVE_TO_PRIVATE_WARNING).toContain("private direct message");
    expect(MOVE_TO_PRIVATE_WARNING).toContain("never deleted");
  });
});
