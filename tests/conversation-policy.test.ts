import { describe, expect, it } from "vitest";

import {
  canAssignConversation,
  canEscalateConversation,
  canMoveToPrivate,
  canReplyToConversation,
  canViewConversation,
} from "@/server/conversations/policy";

describe("conversation view/reply/escalate policy", () => {
  it("grants read to agents but not anonymous callers", () => {
    expect(canViewConversation("AGENT")).toBe(true);
    expect(canViewConversation("QA")).toBe(true);
    expect(canViewConversation(null)).toBe(false);
  });

  it("only lets roles with reply permission reply", () => {
    expect(canReplyToConversation("AGENT")).toBe(true);
    expect(canReplyToConversation("SUPERVISOR")).toBe(false);
    expect(canReplyToConversation("QA")).toBe(false);
  });

  it("only lets roles with escalate permission escalate", () => {
    expect(canEscalateConversation("AGENT")).toBe(true);
    expect(canEscalateConversation("QA")).toBe(false);
  });
});

describe("move-to-private policy", () => {
  it("requires reply permission and a public, unmoved conversation", () => {
    expect(canMoveToPrivate("AGENT", { type: "public", movedToConversationId: null })).toBe(true);
    expect(canMoveToPrivate("AGENT", { type: "private", movedToConversationId: null })).toBe(false);
    expect(canMoveToPrivate("AGENT", { type: "public", movedToConversationId: "cv_dm_0001" })).toBe(false);
    expect(canMoveToPrivate("QA", { type: "public", movedToConversationId: null })).toBe(false);
  });
});

describe("assignment policy", () => {
  it("lets an agent claim unassigned work and keep their own", () => {
    expect(
      canAssignConversation("AGENT", { currentAssigneeId: null, actorId: "usr_agent_maya" }).allowed,
    ).toBe(true);
    expect(
      canAssignConversation("AGENT", {
        currentAssigneeId: "usr_agent_maya",
        actorId: "usr_agent_maya",
      }).allowed,
    ).toBe(true);
  });

  it("stops an agent taking over another agent's conversation", () => {
    const decision = canAssignConversation("AGENT", {
      currentAssigneeId: "usr_agent_kai",
      actorId: "usr_agent_maya",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBeTruthy();
  });

  it("lets a supervisor reassign across the team", () => {
    expect(
      canAssignConversation("SUPERVISOR", {
        currentAssigneeId: "usr_agent_kai",
        actorId: "usr_supervisor",
      }).allowed,
    ).toBe(true);
  });

  it("denies roles without transfer or supervision scope", () => {
    expect(canAssignConversation("QA", { currentAssigneeId: null, actorId: "usr_qa" }).allowed).toBe(
      false,
    );
  });
});
