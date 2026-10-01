import { beforeEach, describe, expect, it } from "vitest";

import type { MessageAuthor } from "@/lib/domain/conversation";
import { DEFAULT_INBOX_QUERY } from "@/lib/domain/inbox";
import { demoInboxStore, resetDemoInboxStore } from "@/server/inbox/store";
import { buildConversationStore } from "@/server/conversations/store";

const AUTHOR: MessageAuthor = {
  id: "usr_agent_maya",
  name: "Maya Keller",
  type: "agent",
  role: "AGENT",
};

const ID = "cv_0001";

describe("conversation store", () => {
  beforeEach(() => {
    resetDemoInboxStore();
  });

  it("builds a deterministic thread for a conversation", () => {
    const first = buildConversationStore().listMessages(ID);
    resetDemoInboxStore();
    const second = buildConversationStore().listMessages(ID);

    expect(first.length).toBeGreaterThan(0);
    expect(first.map((message) => message.id)).toEqual(second.map((message) => message.id));
    expect(first[0]?.conversationId).toBe(ID);
  });

  it("exposes thread metadata and the assignable agents", () => {
    const store = buildConversationStore();
    const info = store.threadInfo(ID);
    expect(info).not.toBeNull();
    expect(["public", "private"]).toContain(info?.type);
    expect(info?.assignees.some((assignee) => assignee.id === "usr_agent_kai")).toBe(true);
    expect(store.threadInfo("cv_9999")).toBeNull();
  });

  it("appends a public reply and reflects it on the conversation", () => {
    const store = buildConversationStore();
    const result = store.sendMessage(ID, {
      kind: "public",
      body: "Thanks for reaching out.",
      attachments: [],
      author: AUTHOR,
    });

    expect(result?.message.kind).toBe("public");
    expect(result?.conversation.preview).toBe("Thanks for reaching out.");
    expect(result?.conversation.status).toBe("awaiting_customer");
    expect(result?.conversation.respondedAt).not.toBeNull();
    expect(store.listMessages(ID).at(-1)?.id).toBe(result?.message.id);
    expect(store.listAudit(ID).some((event) => event.type === "message_public")).toBe(true);
  });

  it("never lets an internal note change the customer-facing preview", () => {
    const store = buildConversationStore();
    const before = store.getConversation(ID)?.preview;

    const result = store.sendMessage(ID, {
      kind: "internal_note",
      body: "Payments team is investigating.",
      attachments: [],
      author: AUTHOR,
    });

    expect(result?.message.kind).toBe("internal_note");
    expect(store.getConversation(ID)?.preview).toBe(before);
    expect(store.listAudit(ID).some((event) => event.type === "note_added")).toBe(true);
  });

  it("returns null when sending to an unknown conversation", () => {
    const store = buildConversationStore();
    expect(
      store.sendMessage("cv_9999", {
        kind: "public",
        body: "hello",
        attachments: [],
        author: AUTHOR,
      }),
    ).toBeNull();
  });

  it("assigns, reassigns and unassigns with an audit entry each time", () => {
    const store = buildConversationStore();
    const unassigned = demoInboxStore()
      .list({ ...DEFAULT_INBOX_QUERY, pageSize: 200 })
      .items.find((item) => item.assignedTo === null);
    if (!unassigned) throw new Error("seed has no unassigned conversation");

    const assigned = store.assign(unassigned.id, { assigneeId: "usr_agent_kai", actor: "Maya Keller" });
    expect(assigned?.conversation.assignedTo?.id).toBe("usr_agent_kai");
    expect(assigned?.event.type).toBe("assigned");

    const reassigned = store.assign(unassigned.id, { assigneeId: "usr_agent_maya", actor: "Maya Keller" });
    expect(reassigned?.conversation.assignedTo?.id).toBe("usr_agent_maya");
    expect(reassigned?.event.type).toBe("reassigned");

    const unassignedAgain = store.assign(unassigned.id, { assigneeId: null, actor: "Maya Keller" });
    expect(unassignedAgain?.conversation.assignedTo).toBeNull();
    expect(unassignedAgain?.event.type).toBe("unassigned");

    expect(store.getConversation("cv_9999")).toBeNull();
    expect(store.assign("cv_9999", { assigneeId: null, actor: "Maya Keller" })).toBeNull();
  });

  it("escalates a conversation and records the optional note internally", () => {
    const store = buildConversationStore();
    const result = store.escalate(ID, {
      reason: "fraud_risk",
      note: "Possible account takeover.",
      author: AUTHOR,
      actor: "Maya Keller",
    });

    expect(result?.conversation.status).toBe("escalated");
    expect(result?.conversation.needsReview).toBe(true);
    expect(result?.event.type).toBe("escalated");
    expect(
      store
        .listMessages(ID)
        .some((message) => message.kind === "internal_note" && message.body === "Possible account takeover."),
    ).toBe(true);
  });

  it("moves a public interaction to a linked private conversation exactly once", () => {
    const store = buildConversationStore();
    const originMessages = store.listMessages(ID).length;

    const moved = store.moveToPrivate(ID, {
      reason: "Sharing account details",
      greeting: "Hi, continuing this privately.",
      author: AUTHOR,
      actor: "Maya Keller",
    });

    expect(moved?.created.id).toBe("cv_dm_0001");
    expect(moved?.event.type).toBe("moved_to_private");

    const created = store.threadInfo("cv_dm_0001");
    expect(created?.type).toBe("private");
    expect(created?.originConversationId).toBe(ID);

    const origin = store.threadInfo(ID);
    expect(origin?.movedToConversationId).toBe("cv_dm_0001");

    // The original public interaction is preserved and only gains a system note.
    expect(store.listMessages(ID).length).toBe(originMessages + 1);
    expect(store.getConversation(ID)?.status).not.toBe("closed");

    const again = store.moveToPrivate(ID, {
      reason: "Sharing account details",
      greeting: "",
      author: AUTHOR,
      actor: "Maya Keller",
    });
    expect(again?.created.id).toBe("cv_dm_0001");
  });

  it("derives customer history from the conversation's customer", () => {
    const store = buildConversationStore();
    const conversation = store.getConversation(ID);
    expect(conversation).not.toBeNull();

    const history = store.customerHistory(conversation!.customer.id);
    expect(history).not.toBeNull();
    expect(history!.totalConversations).toBeGreaterThanOrEqual(1);
    expect(history!.recent.length).toBeGreaterThanOrEqual(1);
    expect(history!.openConversations + history!.resolvedConversations).toBeLessThanOrEqual(
      history!.totalConversations,
    );
  });

  it("reset drops in-memory changes and rebuilds from the seed", () => {
    const store = buildConversationStore();
    store.sendMessage(ID, { kind: "public", body: "ephemeral", attachments: [], author: AUTHOR });
    expect(store.listMessages(ID).some((message) => message.body === "ephemeral")).toBe(true);

    store.reset();
    expect(store.listMessages(ID).some((message) => message.body === "ephemeral")).toBe(false);
    expect(store.threadInfo("cv_dm_0001")).toBeNull();
  });
});
