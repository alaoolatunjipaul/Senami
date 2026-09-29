/**
 * Shared domain taxonomy.
 *
 * These are presentation-facing vocabularies used across the design system and
 * the feature modules. Keeping them in one module means a label or colour is
 * defined once and can never drift between, say, the inbox row and the
 * conversation header.
 */

export const TONES = [
  "primary",
  "success",
  "warning",
  "critical",
  "info",
  "neutral",
  "ai",
  "public",
  "private",
  "internal",
] as const;

export type Tone = (typeof TONES)[number];

/* -------------------------------------------------------------------------
 * Message kinds
 *
 * The public/private distinction is the most important concept in Senami
 * (spec section 3), so each kind has a fixed, non-negotiable label that is
 * rendered on every message and never abbreviated.
 * ---------------------------------------------------------------------- */

export const MESSAGE_KINDS = [
  "public",
  "private",
  "internal_note",
  "ai_generated",
  "system",
] as const;

export type MessageKind = (typeof MESSAGE_KINDS)[number];

export interface MessageKindMeta {
  readonly label: string;
  readonly tone: Tone;
  /** Short explanation used as the accessible description. */
  readonly description: string;
}

export const MESSAGE_KIND_META: Record<MessageKind, MessageKindMeta> = {
  public: {
    label: "PUBLIC",
    tone: "public",
    description: "Visible to anyone on the social platform",
  },
  private: {
    label: "PRIVATE",
    tone: "private",
    description: "Private direct message with the customer",
  },
  internal_note: {
    label: "INTERNAL NOTE",
    tone: "internal",
    description: "Internal only. Never visible to the customer",
  },
  ai_generated: {
    label: "AI GENERATED",
    tone: "ai",
    description: "AI-generated content requiring agent review",
  },
  system: {
    label: "SYSTEM",
    tone: "neutral",
    description: "System event",
  },
};

/* -------------------------------------------------------------------------
 * Priority
 * ---------------------------------------------------------------------- */

export const PRIORITIES = ["critical", "high", "medium", "low", "normal"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "critical" },
  high: { label: "High Priority", tone: "critical" },
  medium: { label: "Medium Priority", tone: "warning" },
  low: { label: "Low Priority", tone: "info" },
  normal: { label: "Normal", tone: "neutral" },
};

/* -------------------------------------------------------------------------
 * Sentiment
 * ---------------------------------------------------------------------- */

export const SENTIMENTS = ["positive", "neutral", "frustrated", "angry", "urgent"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const SENTIMENT_META: Record<Sentiment, { label: string; tone: Tone }> = {
  positive: { label: "Positive", tone: "success" },
  neutral: { label: "Neutral", tone: "neutral" },
  frustrated: { label: "Frustrated", tone: "warning" },
  angry: { label: "Angry", tone: "critical" },
  urgent: { label: "Urgent", tone: "critical" },
};

/* -------------------------------------------------------------------------
 * Conversation status
 * ---------------------------------------------------------------------- */

export const CONVERSATION_STATUSES = [
  "open",
  "pending",
  "awaiting_customer",
  "escalated",
  "resolved",
  "closed",
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CONVERSATION_STATUS_META: Record<ConversationStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "info" },
  pending: { label: "Pending", tone: "warning" },
  awaiting_customer: { label: "Awaiting Customer", tone: "private" },
  escalated: { label: "Escalated", tone: "critical" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

/* -------------------------------------------------------------------------
 * Intent (spec section 19)
 * ---------------------------------------------------------------------- */

export const INTENTS = [
  "card_issue",
  "transfer",
  "mobile_banking",
  "account_issue",
  "fraud_concern",
  "complaint",
  "loan_enquiry",
  "branch_enquiry",
  "general_enquiry",
  "other",
] as const;

export type Intent = (typeof INTENTS)[number];

export const INTENT_META: Record<Intent, string> = {
  card_issue: "Card Issue",
  transfer: "Transfer",
  mobile_banking: "Mobile Banking",
  account_issue: "Account Issue",
  fraud_concern: "Fraud Concern",
  complaint: "Complaint",
  loan_enquiry: "Loan Enquiry",
  branch_enquiry: "Branch Enquiry",
  general_enquiry: "General Enquiry",
  other: "Other",
};

/* -------------------------------------------------------------------------
 * Case / interaction types
 * ---------------------------------------------------------------------- */

export const CASE_TYPES = ["complaint", "enquiry", "request", "follow_up", "fraud"] as const;

export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_TYPE_META: Record<CaseType, string> = {
  complaint: "Complaint",
  enquiry: "Enquiry",
  request: "Request",
  follow_up: "Follow-up",
  fraud: "Fraud Case",
};
