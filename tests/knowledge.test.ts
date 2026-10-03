import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_ARTICLES,
  articleForIntent,
  articlesNeedingReview,
  citableArticles,
  knowledgeSummary,
  searchArticles,
} from "@/lib/domain/knowledge";

describe("knowledge", () => {
  it("cites only published articles", () => {
    for (const article of citableArticles()) {
      expect(article.status).toBe("published");
    }
  });

  it("gives every citable article the version and review date grounding requires", () => {
    for (const article of citableArticles()) {
      expect(article.version, article.id).toBeTruthy();
      expect(article.reviewedAt, article.id).toBeTruthy();
      expect(article.owner, article.id).toBeTruthy();
    }
  });

  it("grounds an intent in one deterministic article", () => {
    expect(articleForIntent("transfer")?.id).toBe("kb_transfer_timing");
    expect(articleForIntent("fraud_concern")?.id).toBe("kb_fraud_first_response");
  });

  it("returns null rather than a guess when nothing claims the intent", () => {
    expect(articleForIntent("unknown_intent" as never)).toBeNull();
  });

  it("never suggests the assistant invent account detail", () => {
    const access = articleForIntent("account_issue");
    expect(access?.id).toBe("kb_account_access");
    expect(access?.body).toMatch(/identification/i);
  });

  it("searches by title, keyword and summary", () => {
    expect(searchArticles("card")[0]?.category).toBe("cards");
    expect(searchArticles("blocked")[0]?.id).toBe("kb_card_blocked");
    expect(searchArticles("nothing here at all")).toEqual([]);
    expect(searchArticles("   ")).toEqual([]);
  });

  it("keeps search ordering stable across calls", () => {
    expect(searchArticles("card").map((a) => a.id)).toEqual(searchArticles("card").map((a) => a.id));
  });

  it("caps the result set", () => {
    expect(searchArticles("a", 2).length).toBeLessThanOrEqual(2);
  });

  it("surfaces articles an administrator should chase", () => {
    const stale = articlesNeedingReview("2026-12-31");
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.every((article) => article.reviewedAt < "2026-12-31")).toBe(true);
  });

  it("summarises every category, including the empty ones", () => {
    const summary = knowledgeSummary("2026-10-03");
    expect(summary).toHaveLength(7);
    for (const entry of summary) {
      expect(entry.published).toBeLessThanOrEqual(entry.total);
      expect(entry.needsReview).toBeLessThanOrEqual(entry.total);
    }
    expect(summary.find((entry) => entry.category === "cards")?.published).toBe(1);
  });

  it("gives every article an owner and a category", () => {
    for (const article of KNOWLEDGE_ARTICLES) {
      expect(article.owner, article.id).not.toBe("");
      expect(article.category, article.id).toBeTruthy();
      expect(article.keywords.length, article.id).toBeGreaterThan(0);
    }
  });
});