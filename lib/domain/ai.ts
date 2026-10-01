import { CHANNEL_LABELS } from "@/lib/config";
import type { ChannelId } from "@/lib/config";
import { isCustomerFacing } from "@/lib/domain/conversation";
import type { MessageDirection } from "@/lib/domain/conversation";
import { SLA_STATE_LABEL, type SlaState } from "@/lib/domain/sla";
import {
  CONVERSATION_STATUS_META,
  INTENT_META,
  type ConversationStatus,
  type Intent,
  type MessageKind,
  type Priority,
  type Sentiment,
} from "@/lib/domain/taxonomy";

/**
 * AI assistance domain (§22, §42).
 *
 * The assistant in Senami is a deterministic mock, but its contract is the real
 * one and is deliberately strict: it only ever produces a *draft*. Nothing it
 * returns is a sent message, every result is editable before it goes anywhere,
 * and the output never claims to have been delivered (§42). Keeping the
 * generation functions pure means the "AI" can be exhaustively tested without a
 * network, an API key or a clock, and swapped for a real model later without any
 * caller changing.
 */

export const AI_ACTIONS = [
  "summarize",
  "suggest",
  "rewrite",
  "shorter",
  "professional",
  "friendlier",
  "extract_intent",
  "next_action",
] as const;

export type AiAction = (typeof AI_ACTIONS)[number];

export interface AiActionMeta {
  readonly label: string;
  readonly description: string;
  /** True when the output is a message body the agent may adopt as a draft. */
  readonly producesDraft: boolean;
  /** True when the action rewrites the agent's own text and needs an input. */
  readonly requiresInput: boolean;
}

export const AI_ACTION_META: Record<AiAction, AiActionMeta> = {
  summarize: {
    label: "Summarize",
    description: "Summarise the conversation so far.",
    producesDraft: false,
    requiresInput: false,
  },
  suggest: {
    label: "Suggest response",
    description: "Draft a reply from the conversation context.",
    producesDraft: true,
    requiresInput: false,
  },
  rewrite: {
    label: "Rewrite",
    description: "Reword your draft without changing what it says.",
    producesDraft: true,
    requiresInput: true,
  },
  shorter: {
    label: "Make shorter",
    description: "Tighten your draft down to the key points.",
    producesDraft: true,
    requiresInput: true,
  },
  professional: {
    label: "Make professional",
    description: "Use formal, precise wording.",
    producesDraft: true,
    requiresInput: true,
  },
  friendlier: {
    label: "Make friendlier",
    description: "Warm the tone without losing the facts.",
    producesDraft: true,
    requiresInput: true,
  },
  extract_intent: {
    label: "Extract intent",
    description: "Read the likely intent and the evidence behind it.",
    producesDraft: false,
    requiresInput: false,
  },
  next_action: {
    label: "Suggest next action",
    description: "Recommend what to do next on this conversation.",
    producesDraft: false,
    requiresInput: false,
  },
};

/** Actions that cannot run without the agent's current text. */
export const AI_ACTIONS_REQUIRING_INPUT: readonly AiAction[] = AI_ACTIONS.filter(
  (action) => AI_ACTION_META[action].requiresInput,
);

export const AI_INPUT_MAX = 2000;
export const AI_OUTPUT_MAX = 2000;

/**
 * A generated suggestion. `editable` and `sent` are literal types on purpose:
 * the assistant can never produce a message that has already been delivered,
 * and every result is editable by construction.
 */
export interface AiSuggestion {
  readonly id: string;
  readonly action: AiAction;
  readonly title: string;
  readonly content: string;
  readonly confidence: number;
  readonly editable: true;
  readonly sent: false;
  readonly createdAt: Date;
}

export interface AiSuggestionDto {
  readonly id: string;
  readonly action: AiAction;
  readonly title: string;
  readonly content: string;
  readonly confidence: number;
  readonly editable: true;
  readonly sent: false;
  readonly createdAt: string;
}

export function toAiSuggestionDto(suggestion: AiSuggestion): AiSuggestionDto {
  return {
    id: suggestion.id,
    action: suggestion.action,
    title: suggestion.title,
    content: suggestion.content,
    confidence: suggestion.confidence,
    editable: suggestion.editable,
    sent: suggestion.sent,
    createdAt: suggestion.createdAt.toISOString(),
  };
}

/** Minimal structural inputs so the generators never depend on the stores. */
export interface AiConversationFacts {
  readonly id: string;
  readonly channel: ChannelId;
  readonly intent: Intent;
  readonly priority: Priority;
  readonly sentiment: Sentiment;
  readonly status: ConversationStatus;
  readonly customerName: string;
  readonly customerHandle: string;
  readonly preview: string;
}

export interface AiMessageFacts {
  readonly kind: MessageKind;
  readonly direction: MessageDirection;
  readonly authorName: string;
  readonly body: string;
}

export interface AiRequest {
  readonly action: AiAction;
  readonly conversation: AiConversationFacts;
  readonly messages: readonly AiMessageFacts[];
  /** The agent's own text, required by the rewriting actions. */
  readonly input?: string;
  readonly slaState?: SlaState;
}

export interface AiResult {
  readonly title: string;
  readonly content: string;
  readonly confidence: number;
}

/**
 * FNV-1a. Used to seed the mock so the same conversation and action always
 * produce the same output - a mock that changes on every click would be
 * untestable and dishonest in a demo.
 */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name.trim();
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function capitalise(text: string): string {
  if (text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function endsWithStop(text: string): boolean {
  return /[.!?]$/.test(text.trimEnd());
}

function terminate(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return trimmed;
  return endsWithStop(trimmed) ? trimmed : `${trimmed}.`;
}

function firstLineOf(text: string): string {
  const sentences = sentencesOf(text);
  return sentences[0] ?? collapseWhitespace(text);
}

const CONTRACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bdon't\b/gi, "do not"],
  [/\bdoesn't\b/gi, "does not"],
  [/\bdidn't\b/gi, "did not"],
  [/\bisn't\b/gi, "is not"],
  [/\baren't\b/gi, "are not"],
  [/\bit's\b/gi, "it is"],
  [/\bwe'll\b/gi, "we will"],
  [/\bwe're\b/gi, "we are"],
  [/\bthey'll\b/gi, "they will"],
  [/\bthanks\b/gi, "thank you"],
  [/\bcheers\b/gi, "thank you"],
];

function expandContractions(text: string): string {
  return CONTRACTIONS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

const INFORMAL_OPENERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^hi\b/i, "Hello"],
  [/^hey\b/i, "Hello"],
  [/^hello\b/i, "Hello"],
  [/^dear\b[^.]*\./i, "Hello,"],
];

function formaliseOpener(text: string): string {
  return INFORMAL_OPENERS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

const DEFAULT_CLOSER = "Kind regards,";

/** Keep the tightest few sentences, preserving their order. */
export function shortenText(text: string, maxSentences = 2): string {
  const sentences = sentencesOf(collapseWhitespace(text));
  if (sentences.length === 0) return "";
  return terminate(sentences.slice(0, Math.max(1, maxSentences)).join(" "));
}

/** Formal, complete wording without changing the substance. */
export function professionaliseText(text: string): string {
  const body = expandContractions(formaliseOpener(collapseWhitespace(text)));
  if (body.length === 0) return "";
  const withoutCloser = body.replace(/(kind regards,?|best regards,?|thank you\.?)\s*$/i, "").trim();
  const core = terminate(capitalise(withoutCloser.length > 0 ? withoutCloser : body));
  return `${core} ${DEFAULT_CLOSER}`;
}

/** Warmer wording with an acknowledgement of the customer's message. */
export function friendlifyText(text: string): string {
  const body = collapseWhitespace(text).replace(/(kind regards,?|best regards,?)\s*$/i, "").trim();
  if (body.length === 0) return "";
  const core = terminate(capitalise(body));
  const warmed = core.startsWith("Thanks for letting us know")
    ? core
    : `Thanks for letting us know. ${core}`;
  return `${warmed} Happy to help with anything else you need.`;
}

/** Clean reword: tidy spacing, contractions resolved, a complete sign-off. */
export function rewriteText(text: string): string {
  const body = collapseWhitespace(text);
  if (body.length === 0) return "";
  const withoutCloser = body.replace(/(kind regards,?|best regards,?|thank you\.)\s*$/i, "").trim();
  const core = terminate(capitalise(expandContractions(withoutCloser.length > 0 ? withoutCloser : body)));
  return `${core} Let me know if you need anything else.`;
}

const SUGGESTION_TEMPLATES: Record<Intent, readonly string[]> = {
  card_issue: [
    `Thanks for flagging this. I'm checking the card on the account now and will confirm what I can see within the hour. If it still declines after a refresh, I can arrange a replacement straight away.`,
    `Sorry about the trouble with your card. I'm looking at the account now and will come back with a fix shortly, including whether a replacement card is the quickest route.`,
  ],
  transfer: [
    `Thanks for the details on the transfer. I'm tracing it now and will confirm the status and any timescale for it to settle.`,
    `I've got the reference you mentioned and I'm checking the transfer with our payments team. I'll update you as soon as I have a confirmed position.`,
  ],
  mobile_banking: [
    `Thanks for letting us know about the app. I'm checking what's happening on your account and will suggest the quickest fix, including clearing the app cache if that helps.`,
    `Sorry the app is being awkward. I'm looking into this now and will follow up with steps you can try while I investigate.`,
  ],
  account_issue: [
    `Thanks for pointing this out. I'm reviewing the account details now and will correct anything that doesn't match your records.`,
    `I've picked this up and I'm checking the account against what you're describing. I'll confirm the fix once I've verified it.`,
  ],
  fraud_concern: [
    `Thank you for reporting this quickly. I've flagged the account for immediate review and I'm securing the affected areas now. I'll come back to you as soon as I have an update.`,
    `I'm treating this as urgent and have placed the account under review. Nothing further is needed from you right now while we check the activity.`,
  ],
  complaint: [
    `I'm sorry this has been frustrating, and I understand why. I'm looking at how it was handled and will come back to you with a clear update.`,
    `Thank you for raising this with us. I'm reviewing what happened and will make sure you get a proper answer rather than another wait.`,
  ],
  loan_enquiry: [
    `Thanks for your enquiry. I'm pulling together the details you need and will send them over shortly.`,
    `Happy to help with this. I'm checking the current criteria so I can give you an accurate answer rather than a rough one.`,
  ],
  branch_enquiry: [
    `Thanks for asking. I'm confirming the details for you and will come back with the exact answer shortly.`,
    `Let me check that for you and make sure I give you the right opening hours and contact details.`,
  ],
  general_enquiry: [
    `Thanks for getting in touch. I'm checking the details so I can give you an accurate answer.`,
    `Happy to look into this. I'm confirming the exact answer and will follow up shortly.`,
  ],
  other: [
    `Thanks for reaching out about this. I'm looking into it now and will come back to you with an update.`,
    `Thanks for your message. I'm checking what I can find and will follow up as soon as I have an answer.`,
  ],
};

function summariseConversation(request: AiRequest): string {
  const { conversation, messages } = request;
  const customerVisible = messages.filter((message) => isCustomerFacing(message.kind));
  const inbound = customerVisible.filter((message) => message.direction === "inbound");
  const outbound = customerVisible.filter((message) => message.direction === "outbound");
  const notes = messages.filter((message) => message.kind === "internal_note");
  const latestInbound = inbound.at(-1);

  const lines = [
    `${conversation.customerName} contacted us on ${CHANNEL_LABELS[conversation.channel]} about ${INTENT_META[conversation.intent].toLowerCase()}.`,
    `${inbound.length} customer message${inbound.length === 1 ? "" : "s"}, ${outbound.length} agent repl${outbound.length === 1 ? "y" : "ies"} and ${notes.length} internal note${notes.length === 1 ? "" : "s"} so far. Status is ${CONVERSATION_STATUS_META[conversation.status].label.toLowerCase()}.`,
  ];

  if (latestInbound) {
    lines.push(`Most recent from the customer: "${firstLineOf(latestInbound.body)}"`);
  } else if (conversation.preview.length > 0) {
    lines.push(`Opening message: "${firstLineOf(conversation.preview)}"`);
  }

  if (notes.length > 0) {
    lines.push(`${notes.length} internal note${notes.length === 1 ? "" : "s"} already capture${notes.length === 1 ? "s" : ""} what the team knows so far.`);
  }

  if (conversation.status === "escalated") {
    lines.push("The conversation is escalated and waiting on a supervisor.");
  }

  if (request.slaState === "breached" || request.slaState === "warning") {
    lines.push(`First-response SLA is ${SLA_STATE_LABEL[request.slaState].toLowerCase()}, so a reply should go out first.`);
  }

  return lines.join(" ");
}

const INTENT_KEYWORDS: Record<Intent, readonly string[]> = {
  card_issue: ["card", "declined", "decline", "payment", "charged", "atm", "cash", "statement"],
  transfer: ["transfer", "sent", "pending", "recall", "fee", "recipient", "settle"],
  mobile_banking: ["app", "log", "login", "face id", "biometric", "update", "install", "crash"],
  account_issue: ["account", "balance", "address", "merged", "details", "profile", "records"],
  fraud_concern: ["fraud", "compromised", "unauthorised", "unauthorized", "pin", "scam", "stolen", "suspicious"],
  complaint: ["complaint", "hold", "second time", "nobody", "formal", "unacceptable", "again"],
  loan_enquiry: ["loan", "mortgage", "documents", "apply", "pre-approval", "quote", "refinance"],
  branch_enquiry: ["branch", "appointment", "advisor", "opening", "saturday", "notarise"],
  general_enquiry: ["limits", "rewards", "apple pay", "statements", "paper", "plan", "international"],
  other: [],
};

export interface AiIntentResult {
  readonly intent: Intent;
  readonly label: string;
  /** 0-1. */
  readonly confidence: number;
  readonly evidence: string;
}

export function extractIntent(request: AiRequest): AiIntentResult {
  const inbound = request.messages
    .filter((message) => message.direction === "inbound" && isCustomerFacing(message.kind))
    .map((message) => message.body);
  const haystack = [...inbound, request.conversation.preview].join(" ").toLowerCase();

  let best: Intent = request.conversation.intent;
  let bestScore = 0;
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [Intent, readonly string[]][]) {
    const score = keywords.reduce((total, keyword) => (haystack.includes(keyword) ? total + 1 : total), 0);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }

  if (bestScore === 0) {
    best = request.conversation.intent;
  }

  const matched = (INTENT_KEYWORDS[best] ?? []).filter((keyword) => haystack.includes(keyword));
  const total = bestScore + matched.length;

  return {
    intent: best,
    label: INTENT_META[best],
    confidence: total === 0 ? 0.4 : Math.min(0.97, 0.55 + bestScore * 0.12),
    evidence:
      matched.length > 0
        ? `Matched on "${matched.slice(0, 3).join('", "')}" in the customer's own words.`
        : "No strong keyword signal, so this follows the routed intent on the conversation.",
  };
}

function nextActionFor(request: AiRequest): string {
  const { conversation } = request;
  const sla = request.slaState;

  if (conversation.status === "escalated") {
    return "This conversation is escalated. Confirm the escalation note explains what the customer needs, then reply to the customer with the position you can give today.";
  }
  if (sla === "breached") {
    return "The first-response SLA has been breached. Send a short public acknowledgement now, add an internal note with what you found, then resolve the underlying issue.";
  }
  if (sla === "warning") {
    return "The first-response SLA is close to breaching. Reply before investigating further so the customer is not left waiting.";
  }
  if (conversation.status === "awaiting_customer") {
    return "The customer has your last reply. If they do not respond before the SLA window closes, send a short check-in rather than leaving it idle.";
  }
  if (conversation.status === "resolved" || conversation.status === "closed") {
    return "This conversation is already resolved. Confirm the outcome matches what the customer asked for, then leave the audit trail as it is.";
  }
  if (conversation.priority === "critical" || conversation.sentiment === "angry") {
    return "Reply publicly to acknowledge the issue, then escalate if you cannot resolve it in this contact.";
  }
  return "Reply publicly with an acknowledgement, add an internal note recording what you found, then resolve the conversation.";
}

/**
 * The single entry point the server calls. Deterministic for a given
 * conversation, action and input, and always returns editable, unsent content.
 */
export function runAiAction(request: AiRequest): AiResult {
  const { action, conversation, input } = request;
  const seed = hashString(`${conversation.id}:${action}:${input ?? ""}`);
  const baseConfidence = 0.6 + ((seed % 33) / 100);

  switch (action) {
    case "summarize":
      return {
        title: "Conversation summary",
        content: truncate(summariseConversation(request)),
        confidence: round2(0.7 + ((seed % 21) / 100)),
      };
    case "suggest": {
      const variants = SUGGESTION_TEMPLATES[conversation.intent];
      const index = seed % Math.max(1, variants.length);
      const body = variants[index] ?? variants[0] ?? "";
      return {
        title: "Suggested reply",
        content: truncate(
          `${firstNameOf(conversation.customerName)}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`,
        ),
        confidence: round2(baseConfidence),
      };
    }
    case "rewrite":
      return {
        title: "Rewritten draft",
        content: truncate(rewriteText(input ?? "")),
        confidence: round2(baseConfidence),
      };
    case "shorter":
      return {
        title: "Shorter draft",
        content: truncate(shortenText(input ?? "")),
        confidence: round2(baseConfidence),
      };
    case "professional":
      return {
        title: "More professional draft",
        content: truncate(professionaliseText(input ?? "")),
        confidence: round2(baseConfidence),
      };
    case "friendlier":
      return {
        title: "Friendlier draft",
        content: truncate(friendlifyText(input ?? "")),
        confidence: round2(baseConfidence),
      };
    case "extract_intent": {
      const result = extractIntent(request);
      return {
        title: "Likely intent",
        content: `${result.label} (${Math.round(result.confidence * 100)}% confidence). ${result.evidence}`,
        confidence: round2(result.confidence),
      };
    }
    case "next_action":
      return {
        title: "Suggested next action",
        content: nextActionFor(request),
        confidence: round2(0.65 + ((seed % 25) / 100)),
      };
  }
}

function truncate(text: string): string {
  return text.length <= AI_OUTPUT_MAX ? text : `${text.slice(0, AI_OUTPUT_MAX - 1)}…`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whether an action is runnable given the text the agent has written. */
export function canRunAiAction(action: AiAction, input: string): boolean {
  if (!AI_ACTION_META[action].requiresInput) return true;
  return input.trim().length > 0;
}