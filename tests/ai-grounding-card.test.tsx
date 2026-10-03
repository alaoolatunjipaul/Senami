import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiGroundingCard } from "@/features/conversation/ai-grounding-card";
import type { AiGovernanceEnvelope } from "@/lib/domain/ai-governance";

const NOW = "2026-10-03T10:00:00.000Z";

function envelope(overrides: Partial<AiGovernanceEnvelope> = {}): AiGovernanceEnvelope {
  return {
    state: "grounded",
    stateLabel: "Grounded",
    tone: "success",
    guidance: "Backed by an approved source. Review as normal and send.",
    band: "high",
    confidence: 0.91,
    mode: "assisted",
    model: "senami-assistant",
    policyVersion: "2026.10.1",
    generatedAt: NOW,
    review: "unreviewed",
    risk: "medium",
    riskLabel: "Medium risk",
    requiresApproval: false,
    canSendUnchanged: true,
    sources: [
      {
        id: "kb_transfer_timing",
        title: "Transfer timings and cut-off times",
        kind: "knowledge_article",
        version: "7.0",
        reviewedAt: "2026-09-02",
      },
    ],
    conditions: ["Every source is versioned and reviewed."],
    sensitiveData: [],
    ...overrides,
  };
}

describe("AiGroundingCard", () => {
  it("shows the state, band and risk for a grounded draft", () => {
    render(<AiGroundingCard governance={envelope()} />);
    expect(screen.getByText("Grounded")).toBeTruthy();
    expect(screen.getByText("High confidence")).toBeTruthy();
    expect(screen.getByText("Medium risk")).toBeTruthy();
  });

  it("shows the confidence band rather than a raw percentage", () => {
    render(<AiGroundingCard governance={envelope()} />);
    expect(screen.queryByText("91%")).toBeNull();
    expect(screen.queryByText("0.91")).toBeNull();
  });

  it("names the source, its kind and its version", () => {
    render(<AiGroundingCard governance={envelope()} />);
    expect(screen.getByText(/Transfer timings/)).toBeTruthy();
    expect(screen.getByText(/Knowledge article · v7\.0/)).toBeTruthy();
  });

  it("says plainly that nothing backs an ungrounded draft", () => {
    render(
      <AiGroundingCard
        governance={envelope({
          state: "no_source",
          stateLabel: "No source",
          tone: "critical",
          sources: [],
          canSendUnchanged: false,
          conditions: ["No knowledge source backs this reply."],
        })}
      />,
    );
    expect(screen.getByText("No source")).toBeTruthy();
    expect(screen.getByText(/Nothing in the knowledge base backs this/)).toBeTruthy();
  });

  it("calls out when approval is required before sending", () => {
    render(
      <AiGroundingCard
        governance={envelope({
          state: "human_approval_required",
          stateLabel: "Human approval required",
          tone: "critical",
          requiresApproval: true,
          canSendUnchanged: false,
        })}
      />,
    );
    expect(screen.getByText("Human approval required")).toBeTruthy();
    expect(screen.getByText(/recorded human approval/)).toBeTruthy();
  });

  it("warns about masked sensitive data without revealing it", () => {
    render(
      <AiGroundingCard
        governance={envelope({
          sensitiveData: [{ kind: "card_number", masked: "••••••••••••1111", label: "Card number" }],
        })}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Card number detected/)).toBeTruthy();
  });

  it("flags an unversioned source instead of presenting it as approved", () => {
    render(
      <AiGroundingCard
        governance={envelope({
          state: "needs_verification",
          stateLabel: "Needs verification",
          tone: "warning",
          sources: [
            {
              id: "kb_draft",
              title: "Draft article",
              kind: "policy",
              version: null,
              reviewedAt: null,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Policy · unversioned/)).toBeTruthy();
  });

  it("shows auto mode distinctly from assisted", () => {
    render(<AiGroundingCard governance={envelope({ mode: "auto" })} />);
    expect(screen.getByText(/Auto-assisted/)).toBeTruthy();
  });

  it("lists the business conditions behind the state", () => {
    render(<AiGroundingCard governance={envelope()} />);
    expect(screen.getByText("Every source is versioned and reviewed.")).toBeTruthy();
  });

  it("never renders a reasoning or thoughts field", () => {
    const { container } = render(
      <AiGroundingCard
        governance={envelope({
          ...({ chainOfThought: "the customer seems anxious" } as Record<string, unknown>),
        })}
      />,
    );
    expect(container.textContent).not.toMatch(/chainOfThought|seems anxious/);
  });
});