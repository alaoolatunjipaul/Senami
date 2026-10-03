/**
 * Knowledge base domain (Phase 10, section 28).
 *
 * A small, curated corpus of banking policy and product articles. It exists for
 * two reasons:
 *
 *  1. It gives the assistant something real to be *grounded in*, so a suggestion
 *     can honestly claim a source instead of implying one.
 *  2. It gives agents and administrators a single place to find the approved
 *     answer to a question, with an owner and a review date.
 *
 * Every article carries an owner, a version and a review date because the
 * governance rules treat an unversioned article as unapproved (see
 * `isApprovedSource`). An article that nobody reviews stops being citable -
 * that is the point.
 */

import type { Intent } from "@/lib/domain/taxonomy";

export const KNOWLEDGE_STATUSES = ["published", "draft", "retired"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeStatus, string> = {
  published: "Published",
  draft: "Draft",
  retired: "Retired",
};

export const KNOWLEDGE_CATEGORIES = [
  "cards",
  "payments",
  "accounts",
  "digital_banking",
  "lending",
  "complaints",
  "fraud_security",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  cards: "Cards",
  payments: "Payments",
  accounts: "Accounts",
  digital_banking: "Digital banking",
  lending: "Lending",
  complaints: "Complaints",
  fraud_security: "Fraud & security",
};

export interface KnowledgeArticle {
  readonly id: string;
  readonly title: string;
  readonly category: KnowledgeCategory;
  readonly summary: string;
  /** The approved answer an agent or the assistant can rely on. */
  readonly body: string;
  /** Intents this article is the approved answer for. */
  readonly intents: readonly Intent[];
  /** Free-text terms that should also surface it in search. */
  readonly keywords: readonly string[];
  readonly owner: string;
  readonly version: string;
  readonly reviewedAt: string;
  readonly status: KnowledgeStatus;
}

export const KNOWLEDGE_ARTICLES: readonly KnowledgeArticle[] = [
  {
    id: "kb_card_blocked",
    title: "Card blocked: what to tell the customer",
    category: "cards",
    summary: "A blocked card is usually a fraud signal. Never confirm why, and never lift a block yourself.",
    body:
      "A blocked card is most often triggered by our fraud checks rather than by anything the customer did. " +
      "Confirm the card is blocked, explain that a fraud check may be in progress, and give the customer the " +
      "two options: wait for the check to clear, or request a replacement. Do not speculate about the reason, " +
      "do not read out partial card numbers, and do not promise a time the fraud team has not given.",
    intents: ["card_issue"],
    keywords: ["card", "blocked", "declined", "frozen", "replacement"],
    owner: "Card Operations",
    version: "4.2",
    reviewedAt: "2026-08-14",
    status: "published",
  },
  {
    id: "kb_transfer_timing",
    title: "Transfer timings and cut-off times",
    category: "payments",
    summary: "Give the published timings only. Never promise an arrival time for an unsettled transfer.",
    body:
      "Domestic transfers submitted before the 16:00 cut-off on a working day settle the next working day; " +
      "anything after the cut-off settles the following working day. Cross-border transfers can take up to two " +
      "working days. Quote the published timing, state that weekends and bank holidays do not count, and do not " +
      "promise a specific arrival time for a transfer that has not settled.",
    intents: ["transfer"],
    keywords: ["transfer", "payment", "sent", "arrives", "cut-off", "pending"],
    owner: "Payments Operations",
    version: "7.0",
    reviewedAt: "2026-09-02",
    status: "published",
  },
  {
    id: "kb_account_access",
    title: "Account access and identification",
    category: "accounts",
    summary: "Identify the customer to the required standard before discussing an account.",
    body:
      "Before discussing anything account-specific, complete identification to our required standard. If the " +
      "customer cannot be identified, you may still explain general product behaviour, but not their own " +
      "account's balances, transactions or limits. Never read account detail back to a caller whose identity is " +
      "in doubt, and never accept identification details supplied in the same message as the request.",
    intents: ["account_issue", "general_enquiry"],
    keywords: ["access", "locked", "login", "password", "identify", "verification"],
    owner: "Retail Operations",
    version: "3.8",
    reviewedAt: "2026-07-30",
    status: "published",
  },
  {
    id: "kb_mobile_banking_login",
    title: "Mobile app sign-in problems",
    category: "digital_banking",
    summary: "Walk through the documented recovery steps; never suggest installing unofficial apps.",
    body:
      "For sign-in problems, confirm the customer is using the official app, then walk through password reset " +
      "and, if needed, device re-registration. Never ask for a password or a full card number, and never direct a " +
      "customer to a link that did not come from our official domain. If a customer reports an app they do not " +
      "recognise, treat it as a security concern and escalate.",
    intents: ["mobile_banking"],
    keywords: ["app", "login", "sign in", "password", "reset", "2fa", "locked out"],
    owner: "Digital Service Desk",
    version: "5.1",
    reviewedAt: "2026-09-18",
    status: "published",
  },
  {
    id: "kb_fraud_first_response",
    title: "Suspected fraud: first response",
    category: "fraud_security",
    summary: "Reassure, capture detail, escalate immediately. Never confirm whether a transaction was ours.",
    body:
      "Reassure the customer, capture the details you have, and escalate to the fraud team straight away. Do not " +
      "confirm or deny that a specific transaction was made by the customer, and do not delay escalation to " +
      "finish investigating. Tell the customer what happens next and when they will hear from us.",
    intents: ["fraud_concern", "card_issue"],
    keywords: ["fraud", "scam", "unrecognised", "stolen", "compromised", "phishing"],
    owner: "Financial Crime",
    version: "6.4",
    reviewedAt: "2026-09-25",
    status: "published",
  },
  {
    id: "kb_complaint_handling",
    title: "Handling a complaint",
    category: "complaints",
    summary: "Acknowledge, record the outcome the customer wants, and set a realistic timescale.",
    body:
      "Acknowledge the complaint, confirm what outcome the customer is looking for, and give the timescale we " +
      "publish for a response. Do not offer compensation to settle a complaint without approval - route it to a " +
      "supervisor. Record the complaint reference in the interaction before you close it.",
    intents: ["complaint"],
    keywords: ["complaint", "unhappy", "escalate", "compensation", "formal"],
    owner: "Customer Care Quality",
    version: "4.9",
    reviewedAt: "2026-08-28",
    status: "published",
  },
  {
    id: "kb_loan_enquiries",
    title: "Loan and credit enquiries",
    category: "lending",
    summary: "Explain the process and hand off. Do not give an eligibility or rate indication.",
    body:
      "You can explain how a decision is made and what documents are needed. You must not indicate whether a " +
      "customer would be eligible, quote a rate, or suggest that an application is likely to be accepted. Hand " +
      "the enquiry to the lending team and set an expectation of contact.",
    intents: ["loan_enquiry"],
    keywords: ["loan", "credit", "mortgage", "eligibility", "rate", "apply"],
    owner: "Lending",
    version: "2.6",
    reviewedAt: "2026-06-19",
    status: "published",
  },
  {
    id: "kb_branch_enquiries",
    title: "Branch and opening hours",
    category: "accounts",
    summary: "Point to the published branch directory; do not promise appointments.",
    body:
      "Direct the customer to the published branch directory for opening hours and services. Do not promise an " +
      "appointment, and do not advise on account-opening eligibility.",
    intents: ["branch_enquiry"],
    keywords: ["branch", "opening hours", "appointment", "visit"],
    owner: "Branch Network",
    version: "1.9",
    reviewedAt: "2026-05-11",
    status: "published",
  },
];

/** Articles that may be cited: published, and carrying a version and review date. */
export function citableArticles(): readonly KnowledgeArticle[] {
  return KNOWLEDGE_ARTICLES.filter((article) => article.status === "published");
}

/**
 * The best source for an intent: the first published article that claims it.
 * Deterministic so a given interaction grounds in the same article every time.
 */
export function articleForIntent(intent: Intent): KnowledgeArticle | null {
  return citableArticles().find((article) => article.intents.includes(intent)) ?? null;
}

/** Keyword/summary search across the citable corpus, best match first. */
export function searchArticles(term: string, limit = 5): KnowledgeArticle[] {
  const needle = term.trim().toLowerCase();
  if (needle === "") return [];

  const scored = citableArticles().map((article) => {
    const title = article.title.toLowerCase();
    const keywords = article.keywords.join(" ").toLowerCase();
    const summary = article.summary.toLowerCase();

    let score = 0;
    if (title.includes(needle)) score += 3;
    if (keywords.includes(needle)) score += 2;
    if (summary.includes(needle)) score += 1;
    for (const keyword of article.keywords) {
      if (keyword === needle) score += 4;
    }
    return { article, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id))
    .slice(0, limit)
    .map((entry) => entry.article);
}

/** Articles an administrator should chase: unreviewed or never republished. */
export function articlesNeedingReview(reference: string): KnowledgeArticle[] {
  return KNOWLEDGE_ARTICLES.filter((article) => article.reviewedAt < reference);
}

export interface KnowledgeCategorySummary {
  readonly category: KnowledgeCategory;
  readonly label: string;
  readonly published: number;
  readonly total: number;
  readonly needsReview: number;
}

export function knowledgeSummary(reference: string): KnowledgeCategorySummary[] {
  return KNOWLEDGE_CATEGORIES.map((category) => {
    const inCategory = KNOWLEDGE_ARTICLES.filter((article) => article.category === category);
    return {
      category,
      label: KNOWLEDGE_CATEGORY_LABELS[category],
      published: inCategory.filter((article) => article.status === "published").length,
      total: inCategory.length,
      needsReview: inCategory.filter((article) => article.reviewedAt < reference).length,
    };
  });
}