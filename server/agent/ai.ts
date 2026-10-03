import {
  AI_ACTIONS,
  AI_ACTION_META,
  AI_INPUT_MAX,
  AI_OUTPUT_MAX,
  canRunAiAction,
  hashString,
  runAiAction,
  toAiSuggestionDto,
  type AiAction,
  type AiRequest,
  type AiResult,
  type AiSuggestion,
  type AiSuggestionDto,
} from "@/lib/domain/ai";
import type { InboxConversation } from "@/lib/domain/inbox";
import { slaEvaluationOf } from "@/lib/domain/inbox";
import { canAssistIntent, canUseAiAction } from "@/lib/domain/ai-governance";
import { demoConversationStore } from "@/server/conversations/store";
import { currentAiPolicy } from "@/server/governance/ai-policy-store";
import { governDraft, type AiGovernanceEnvelope } from "@/server/governance/ai-service";

/**
 * AI assistance service.
 *
 * Wraps the pure generators in `lib/domain/ai` with the conversation store, so a
 * route handler never touches the timeline directly. Two rules are enforced
 * here rather than trusted to the UI:
 *
 *  1. a suggestion is a draft - it is never appended to the timeline and never
 *     described as sent (§8, §42);
 *  2. the rewriting actions require the agent's own text, and the input is
 *     length-checked before anything is generated.
 */

export interface AiSuggestionRequest {
  readonly conversationId: string;
  readonly action: AiAction;
  readonly input?: string;
  readonly actor: string;
  readonly now?: Date;
}

export interface AiSuggestionResponse {
  readonly suggestion: AiSuggestionDto;
  /** Echoed so the client can render a note about what happened. */
  readonly disposition: "draft_only";
  readonly notice: string;
  /** Grounding, provenance and policy facts for this specific draft. */
  readonly governance: AiGovernanceEnvelope;
}

export const AI_NOT_SENT_NOTICE =
  "This is a draft. Nothing has been sent - edit it in the composer and send it yourself.";

/** Extra notice when the grounding state blocks an unedited send. */
export function governanceNotice(envelope: AiGovernanceEnvelope): string | null {
  if (envelope.canSendUnchanged) return null;
  return envelope.state === "human_approval_required"
    ? "A supervisor must approve this before it goes to the customer."
    : envelope.guidance;
}

export class AiActionError extends Error {
  override readonly name = "AiActionError";
  constructor(
    readonly code:
      | "unknown_action"
      | "input_required"
      | "input_too_long"
      | "output_too_long"
      | "capability_disabled"
      | "intent_blocked",
    message: string,
  ) {
    super(message);
  }
}

function isAiAction(value: string): value is AiAction {
  return (AI_ACTIONS as readonly string[]).includes(value);
}

/** Build the generator input from the stored thread. */
function toAiRequest(
  conversation: InboxConversation,
  action: AiAction,
  input: string | undefined,
): AiRequest {
  const messages = demoConversationStore().listMessages(conversation.id);
  return {
    action,
    conversation: {
      id: conversation.id,
      channel: conversation.channel,
      intent: conversation.intent,
      priority: conversation.priority,
      sentiment: conversation.sentiment,
      status: conversation.status,
      customerName: conversation.customer.name,
      customerHandle: conversation.customer.handle,
      preview: conversation.preview,
    },
    messages: messages.map((message) => ({
      kind: message.kind,
      direction: message.direction,
      authorName: message.author.name,
      body: message.body,
    })),
    input,
    slaState: slaEvaluationOf(conversation).state,
  };
}

export function runAssistant(request: AiSuggestionRequest): AiSuggestionResponse | null {
  const conversation = demoConversationStore().getConversation(request.conversationId);
  if (!conversation) return null;

  if (!isAiAction(request.action)) {
    throw new AiActionError("unknown_action", `"${request.action}" is not an AI action.`);
  }
  const action = request.action;

  const policy = currentAiPolicy();
  const intentDecision = canAssistIntent(policy, conversation.intent);
  if (!intentDecision.allowed) {
    throw new AiActionError("intent_blocked", intentDecision.reason);
  }
  const actionDecision = canUseAiAction(policy, action);
  if (!actionDecision.allowed) {
    throw new AiActionError("capability_disabled", actionDecision.reason);
  }

  const input = request.input?.trim() ?? "";
  if (input.length > AI_INPUT_MAX) {
    throw new AiActionError(
      "input_too_long",
      `Send at most ${AI_INPUT_MAX} characters of your own text to the assistant.`,
    );
  }
  if (!canRunAiAction(action, input)) {
    throw new AiActionError(
      "input_required",
      `${AI_ACTION_META[action].label} rewrites your own text, so write or paste something first.`,
    );
  }

  const now = request.now ?? new Date();
  const result: AiResult = runAiAction(toAiRequest(conversation, action, input));
  if (result.content.length > AI_OUTPUT_MAX) {
    throw new AiActionError("output_too_long", "The assistant produced too much text to use as a draft.");
  }

  const { envelope } = governDraft(
    {
      action,
      intent: conversation.intent,
      content: result.content,
      confidence: result.confidence,
      escalated: conversation.status === "escalated",
    },
    policy,
    now,
  );

  const seed = hashString(`${conversation.id}:${action}:${input}:${now.toISOString()}`);
  const suggestion: AiSuggestion = {
    id: `sug_${conversation.id}_${String(seed % 100000).padStart(5, "0")}`,
    action,
    title: result.title,
    content: result.content,
    confidence: result.confidence,
    editable: true,
    sent: false,
    createdAt: now,
  };

  demoConversationStore().recordAiSuggestion(
    conversation.id,
    {
      actor: request.actor,
      action,
      suggestionId: suggestion.id,
      grounding: {
        state: envelope.state,
        band: envelope.band,
        sourceIds: envelope.sources.map((source) => source.id),
        policyVersion: envelope.policyVersion,
        requiresApproval: envelope.requiresApproval,
      },
    },
    now,
  );

  const notice = governanceNotice(envelope);
  return {
    suggestion: toAiSuggestionDto(suggestion),
    disposition: "draft_only",
    notice: notice === null ? AI_NOT_SENT_NOTICE : `${AI_NOT_SENT_NOTICE} ${notice}`,
    governance: envelope,
  };
}