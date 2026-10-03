import { describe, expect, it } from "vitest";

import {
  AI_ACTION_RISK,
  AI_RESPONSE_STATES,
  AI_RESPONSE_STATE_META,
  COMMITMENT_ACTION_META,
  CUSTOMER_COMMITMENT_ACTIONS,
  DEFAULT_AI_POLICY,
  assessActionRisk,
  canAssistIntent,
  canSendUnchanged,
  canUseAiAction,
  confidenceBand,
  evaluateGrounding,
  hasForbiddenProvenanceFields,
  isApprovedSource,
  maskValue,
  scanForSensitiveData,
  type AiPolicy,
  type AiProvenance,
  type AiSource,
  type GroundingInput,
} from "@/lib/domain/ai-governance";

const APPROVED_SOURCE: AiSource = {
  id: "kb_transfer_timing",
  title: "Transfer timings and cut-off times",
  kind: "knowledge_article",
  version: "7.0",
  reviewedAt: "2026-09-02",
};

const UNVERSIONED_SOURCE: AiSource = {
  id: "kb_draft",
  title: "Draft article",
  kind: "knowledge_article",
  version: null,
  reviewedAt: null,
};

function grounding(overrides: Partial<GroundingInput> = {}): GroundingInput {
  return {
    action: "suggest",
    intent: "transfer",
    confidence: 0.92,
    sources: [APPROVED_SOURCE],
    escalated: false,
    risk: "medium",
    policy: DEFAULT_AI_POLICY,
    ...overrides,
  };
}

describe("ai-governance", () => {
  describe("confidence bands", () => {
    it("bands a score instead of reporting a false precision", () => {
      expect(confidenceBand(0.92)).toBe("high");
      expect(confidenceBand(0.8)).toBe("high");
      expect(confidenceBand(0.6)).toBe("medium");
      expect(confidenceBand(0.79)).toBe("medium");
      expect(confidenceBand(0.59)).toBe("low");
      expect(confidenceBand(0)).toBe("low");
    });
  });

  describe("approved sources", () => {
    it("requires both a version and a review date", () => {
      expect(isApprovedSource(APPROVED_SOURCE)).toBe(true);
      expect(isApprovedSource(UNVERSIONED_SOURCE)).toBe(false);
      expect(isApprovedSource({ ...APPROVED_SOURCE, reviewedAt: null })).toBe(false);
      expect(isApprovedSource({ ...APPROVED_SOURCE, version: null })).toBe(false);
    });
  });

  describe("evaluateGrounding", () => {
    it("is grounded only when every source is approved and confidence is high", () => {
      const assessment = evaluateGrounding(grounding());
      expect(assessment.state).toBe("grounded");
      expect(assessment.approvedSourceCount).toBe(1);
      expect(assessment.requiresApproval).toBe(false);
    });

    it("reports no_source rather than a weaker form of grounded", () => {
      expect(evaluateGrounding(grounding({ sources: [] })).state).toBe("no_source");
    });

    it("treats unversioned sources as absent approval", () => {
      const assessment = evaluateGrounding(grounding({ sources: [UNVERSIONED_SOURCE] }));
      expect(assessment.state).toBe("no_source");
      expect(assessment.approvedSourceCount).toBe(0);
    });

    it("asks for verification when an unapproved source sits beside an approved one", () => {
      const assessment = evaluateGrounding(
        grounding({ sources: [APPROVED_SOURCE, UNVERSIONED_SOURCE] }),
      );
      expect(assessment.state).toBe("needs_verification");
    });

    it("reports low_confidence on a weak signal", () => {
      expect(evaluateGrounding(grounding({ confidence: 0.4 })).state).toBe("low_confidence");
    });

    it("escalates rather than offering a suggestion when policy says so", () => {
      const policy: AiPolicy = { ...DEFAULT_AI_POLICY, escalateOnLowConfidence: true };
      expect(evaluateGrounding(grounding({ confidence: 0.7, policy })).state).toBe(
        "low_confidence",
      );
    });

    it("lets escalation outrank confidence", () => {
      expect(
        evaluateGrounding(grounding({ escalated: true, confidence: 0.99 })).state,
      ).toBe("escalation_required");
    });

    it("requires approval when the action is high risk, whatever the confidence", () => {
      expect(evaluateGrounding(grounding({ risk: "high", confidence: 0.99 })).state).toBe(
        "human_approval_required",
      );
    });

    it("names conditions in business terms, never as model reasoning", () => {
      for (const conditions of [
        evaluateGrounding(grounding()).conditions,
        evaluateGrounding(grounding({ sources: [] })).conditions,
      ]) {
        for (const condition of conditions) {
          expect(condition).not.toMatch(/because the model|chain of thought|step \d/i);
        }
      }
    });
  });

  describe("response states", () => {
    it("blocks sending for exactly the states that lack a safe basis", () => {
      const blocking = AI_RESPONSE_STATES.filter((state) => !canSendUnchanged(state));
      expect(blocking).toEqual([
        "no_source",
        "escalation_required",
        "human_approval_required",
      ]);
    });

    it("gives every state a label, tone and guidance", () => {
      for (const state of AI_RESPONSE_STATES) {
        const meta = AI_RESPONSE_STATE_META[state];
        expect(meta.label).not.toBe("");
        expect(meta.guidance).not.toBe("");
        expect(meta.tone).toBeTruthy();
      }
    });
  });

  describe("provenance", () => {
    const provenance: AiProvenance = {
      model: "senami-assistant",
      capability: "suggest",
      policyVersion: DEFAULT_AI_POLICY.version,
      generatedAt: "2026-10-03T10:00:00.000Z",
      confidence: { score: 0.92, band: "high", basis: "Approved knowledge match" },
      sources: [APPROVED_SOURCE],
      review: "unreviewed",
    };

    it("carries business facts only", () => {
      expect(hasForbiddenProvenanceFields(provenance)).toEqual([]);
    });

    it("fails loudly if reasoning is ever added", () => {
      const leaked = { ...provenance, reasoning: "the customer is worried about fees" };
      expect(hasForbiddenProvenanceFields(leaked)).toContain("reasoning");
    });
  });

  describe("action risk", () => {
    it("treats every assistant capability as at most medium risk", () => {
      for (const [action, risk] of Object.entries(AI_ACTION_RISK)) {
        expect(risk, action).not.toBe("high");
      }
    });

    it("never lets the assistant draft a customer commitment", () => {
      for (const action of CUSTOMER_COMMITMENT_ACTIONS) {
        expect(COMMITMENT_ACTION_META[action].aiMayDraft, action).toBe(false);
      }
    });

    it("rates the irreversible commitments high risk", () => {
      expect(COMMITMENT_ACTION_META.issue_refund.risk).toBe("high");
      expect(COMMITMENT_ACTION_META.close_account.risk).toBe("high");
      expect(COMMITMENT_ACTION_META.confirm_transaction.risk).toBe("high");
    });

    it("requires approval for high risk and records why", () => {
      const decision = assessActionRisk("high", DEFAULT_AI_POLICY);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.autoModePermitted).toBe(false);
      expect(decision.rationale).toMatch(/approval/i);
    });

    it("keeps auto mode off anything above low risk", () => {
      const autoPolicy: AiPolicy = { ...DEFAULT_AI_POLICY, mode: "auto" };
      expect(assessActionRisk("low", autoPolicy).autoModePermitted).toBe(true);
      expect(assessActionRisk("medium", autoPolicy).autoModePermitted).toBe(false);
      expect(assessActionRisk("high", autoPolicy).autoModePermitted).toBe(false);
    });

    it("keeps auto mode off low risk when the deployment is assisted", () => {
      expect(assessActionRisk("low", DEFAULT_AI_POLICY).autoModePermitted).toBe(false);
    });
  });

  describe("policy gates", () => {
    it("refuses a capability that policy switched off", () => {
      const policy: AiPolicy = { ...DEFAULT_AI_POLICY, enabledActions: ["summarize"] };
      expect(canUseAiAction(policy, "suggest").allowed).toBe(false);
      expect(canUseAiAction(policy, "summarize").allowed).toBe(true);
    });

    it("refuses a blocked intent whatever the mode", () => {
      const policy: AiPolicy = { ...DEFAULT_AI_POLICY, mode: "auto", blockedIntents: ["fraud_concern"] };
      const decision = canAssistIntent(policy, "fraud_concern");
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBeTruthy();
    });
  });

  describe("sensitive data", () => {
    it("keeps the last four digits and nothing else", () => {
      expect(maskValue("4111111111111111")).toBe("••••••••••••1111");
    });

    it("masks a card number and keeps the raw value out of the finding", () => {
      const findings = scanForSensitiveData("my card is 4111 1111 1111 1111");
      const finding = findings.find((entry) => entry.kind === "card_number");
      expect(finding).toBeDefined();
      expect(finding?.masked).not.toContain("4111 1111");
      expect(finding?.masked.endsWith("1111")).toBe(true);
    });

    it("flags a bare account identifier", () => {
      const findings = scanForSensitiveData("reference 123456789");
      expect(findings.some((finding) => finding.kind === "account_identifier")).toBe(true);
    });

    it("does not invent findings for ordinary prose", () => {
      expect(scanForSensitiveData("thanks, I will transfer it on Monday morning")).toEqual([]);
    });
  });
});