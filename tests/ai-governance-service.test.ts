import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_AI_POLICY, hasForbiddenProvenanceFields } from "@/lib/domain/ai-governance";
import { AiActionError, runAssistant } from "@/server/agent/ai";
import {
  aiPolicyHistory,
  currentAiPolicy,
  resetAiPolicy,
  updateAiPolicy,
} from "@/server/governance/ai-policy-store";
import { governDraft, sourcesFor, type GovernedAiDraft } from "@/server/governance/ai-service";
import { demoInboxStore } from "@/server/inbox/store";
import { DEFAULT_INBOX_QUERY } from "@/lib/domain/inbox";

const NOW = new Date("2026-10-03T10:00:00.000Z");

function draft(overrides: Partial<GovernedAiDraft> = {}): GovernedAiDraft {
  return {
    action: "suggest",
    intent: "transfer",
    content: "Thanks for getting in touch about your transfer.",
    confidence: 0.9,
    escalated: false,
    ...overrides,
  };
}

beforeEach(() => {
  resetAiPolicy();
});

describe("governance service", () => {
  describe("source selection", () => {
    it("grounds an intent in that intent's approved article", () => {
      const [source] = sourcesFor(draft());
      expect(source?.id).toBe("kb_transfer_timing");
      expect(source?.kind).toBe("knowledge_article");
      expect(source?.version).not.toBeNull();
    });

    it("returns no source rather than a loose match for an uncovered intent", () => {
      expect(sourcesFor(draft({ intent: "other", content: "zzz" }))).toEqual([]);
    });

    it("falls back to keyword search when no article claims the intent", () => {
      const sources = sourcesFor(
        draft({ intent: "other", content: "my replacement card has not arrived yet" }),
      );
      expect(sources).toHaveLength(1);
      expect(sources[0]?.id).toBe("kb_card_blocked");
    });
  });

  describe("envelope", () => {
    it("reports grounded with an approval-ready send for a covered intent", () => {
      const { envelope } = governDraft(draft(), DEFAULT_AI_POLICY, NOW);
      expect(envelope.state).toBe("grounded");
      expect(envelope.canSendUnchanged).toBe(true);
      expect(envelope.requiresApproval).toBe(false);
      expect(envelope.band).toBe("high");
      expect(envelope.sources).toHaveLength(1);
    });

    it("refuses to let an unedited draft go out with no source", () => {
      const { envelope } = governDraft(
        draft({ intent: "other", content: "zzz" }),
        DEFAULT_AI_POLICY,
        NOW,
      );
      expect(envelope.state).toBe("no_source");
      expect(envelope.canSendUnchanged).toBe(false);
    });

    it("blocks a draft on an escalated interaction even when it is well grounded", () => {
      const { envelope } = governDraft(draft({ escalated: true }), DEFAULT_AI_POLICY, NOW);
      expect(envelope.state).toBe("escalation_required");
      expect(envelope.canSendUnchanged).toBe(false);
    });

    it("never marks a drafting capability as requiring approval", () => {
      const { envelope } = governDraft(draft({ action: "summarize" }), DEFAULT_AI_POLICY, NOW);
      expect(envelope.requiresApproval).toBe(false);
      expect(envelope.risk).toBe("low");
    });

    it("records the model, policy version and timestamp in provenance", () => {
      const { provenance } = governDraft(draft(), DEFAULT_AI_POLICY, NOW);
      expect(provenance.model).toBe("senami-assistant");
      expect(provenance.policyVersion).toBe(DEFAULT_AI_POLICY.version);
      expect(provenance.generatedAt).toBe(NOW.toISOString());
      expect(provenance.review).toBe("unreviewed");
      expect(provenance.confidence.basis).toMatch(/knowledge/i);
    });

    it("keeps provenance reasoning-free in every state", () => {
      for (const variant of [
        draft(),
        draft({ escalated: true }),
        draft({ intent: "other", content: "zzz" }),
        draft({ confidence: 0.2 }),
      ]) {
        expect(hasForbiddenProvenanceFields(governDraft(variant, DEFAULT_AI_POLICY, NOW).provenance))
          .toEqual([]);
      }
    });

    it("masks sensitive data found in the generated text", () => {
      const { envelope } = governDraft(
        draft({ content: "Your card 4111 1111 1111 1111 has been reissued." }),
        DEFAULT_AI_POLICY,
        NOW,
      );
      const finding = envelope.sensitiveData.find((entry) => entry.kind === "card_number");
      expect(finding).toBeDefined();
      expect(finding?.masked.endsWith("1111")).toBe(true);
    });

    it("keeps an empty sensitive-data list for ordinary wording", () => {
      expect(governDraft(draft(), DEFAULT_AI_POLICY, NOW).envelope.sensitiveData).toEqual([]);
    });

    it("surfaces auto mode without relaxing the approval rule", () => {
      const auto = updateAiPolicy({ ...DEFAULT_AI_POLICY, mode: "auto" }, "admin", NOW);
      const { envelope } = governDraft(draft({ action: "summarize" }), auto, NOW);
      expect(envelope.mode).toBe("auto");
      expect(envelope.requiresApproval).toBe(false);
    });
  });
});

describe("assistant integration", () => {
  function conversationWithIntent(intent: string): string {
    const items = demoInboxStore().list({ ...DEFAULT_INBOX_QUERY, pageSize: 200 }).items;
    const match = items.find((item) => item.intent === intent);
    if (!match) throw new Error(`no seeded conversation for intent ${intent}`);
    return match.id;
  }

  it("returns a governed draft rather than bare text", () => {
    const response = runAssistant({
      conversationId: conversationWithIntent("transfer"),
      action: "suggest",
      actor: "agent.ellis",
      now: NOW,
    });
    expect(response).not.toBeNull();
    expect(response?.disposition).toBe("draft_only");
    expect(response?.governance.state).toBeTruthy();
    expect(response?.governance.sources.length).toBeGreaterThan(0);
    expect(response?.suggestion.sent).toBe(false);
  });

  it("keeps the never-sent notice even when grounding blocks the draft", () => {
    const items = demoInboxStore().list({ ...DEFAULT_INBOX_QUERY, pageSize: 200 }).items;
    const uncovered = items.find((item) => item.intent === "other");
    if (!uncovered) return;
    const response = runAssistant({
      conversationId: uncovered.id,
      action: "summarize",
      actor: "agent.ellis",
      now: NOW,
    });
    expect(response?.notice).toMatch(/Nothing has been sent/);
  });

  it("refuses a capability that policy switched off", () => {
    updateAiPolicy({ ...DEFAULT_AI_POLICY, enabledActions: ["summarize"] }, "admin", NOW);
    expect(() =>
      runAssistant({
        conversationId: conversationWithIntent("transfer"),
        action: "suggest",
        actor: "agent.ellis",
        now: NOW,
      }),
    ).toThrowError(AiActionError);
  });

  it("refuses an intent that policy blocked", () => {
    updateAiPolicy({ ...DEFAULT_AI_POLICY, blockedIntents: ["transfer"] }, "admin", NOW);
    let thrown: unknown;
    try {
      runAssistant({
        conversationId: conversationWithIntent("transfer"),
        action: "summarize",
        actor: "agent.ellis",
        now: NOW,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AiActionError);
    expect((thrown as AiActionError).code).toBe("intent_blocked");
  });

  it("returns null for an unknown conversation", () => {
    expect(
      runAssistant({ conversationId: "cv_missing", action: "summarize", actor: "a", now: NOW }),
    ).toBeNull();
  });
});

describe("policy store", () => {
  it("bumps the version so old drafts keep their original rules", () => {
    const before = currentAiPolicy().version;
    const after = updateAiPolicy({ ...DEFAULT_AI_POLICY, mode: "auto" }, "admin", NOW);
    expect(after.version).not.toBe(before);
  });

  it("records who changed what", () => {
    updateAiPolicy({ ...DEFAULT_AI_POLICY, mode: "auto" }, "admin.ross", NOW);
    const [change] = aiPolicyHistory();
    expect(change?.actor).toBe("admin.ross");
    expect(change?.summary).toMatch(/mode assisted -> auto/);
  });

  it("records nothing when nothing changed", () => {
    const policy = updateAiPolicy({ ...currentAiPolicy() }, "admin", NOW);
    expect(aiPolicyHistory()).toHaveLength(0);
    expect(policy.version).toBe(currentAiPolicy().version);
  });

  it("restores the default policy", () => {
    updateAiPolicy({ ...DEFAULT_AI_POLICY, mode: "auto" }, "admin", NOW);
    resetAiPolicy();
    expect(currentAiPolicy()).toEqual(DEFAULT_AI_POLICY);
    expect(aiPolicyHistory()).toHaveLength(0);
  });
});