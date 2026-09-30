# Senami — AI Guardrails

Status: the AI domain (Phase 9) implements the provider port and guardrails on this design. The
demo runs with `AI_PROVIDER=mock` and **no API key**, so nothing here calls a live model. The rules
below are the contract the AI module is built against; `docs/PROJECT-SUMMARY.md` tracks delivery.

## Operating principles

1. **AI assists; people decide.** No AI-generated text is sent to a customer without an explicit
   agent action. AI never performs privileged operations on its own.
2. **A deterministic demo.** `MockAIProvider` returns stable, labelled output so the product can be
   built, tested and demonstrated offline with zero credentials.
3. **Every generation is recorded.** Any AI suggestion is logged to `ai_generations` and, when it
   influences a customer-visible message, linked through the audit trail.
4. **Model freedom is bounded by policy.** `ai.manage` controls which assistance features run and
   on which channels; nothing is assumed when the policy is missing.

## The four prohibitions

| Rule | Enforced by |
| --- | --- |
| Never assert fabricated facts about the customer, the order, or the platform | Draft composer refuses to inject claims not present in the conversation, customer profile, case or knowledge base |
| Never reveal, echo or reformat sensitive data into public content | `PUBLIC` composer scans for sensitive markers (emails, PII, requested secrets) and **blocks sending** until an agent acknowledges |
| Never click, apply or 'approve' automatically | Approval is an explicit agent action; the AI sends a *suggestion* only |
| Never improvise the guardrails themselves | Guardrail checks run through the provider-independent module, never in provider adapters |

## Feature behaviour

| AI feature | What it does | Output gating |
| --- | --- | --- |
| Intent classification | Suggests the conversation intent | Advisory label in workspace |
| Sentiment | Suggests sentiment with confidence | Advisory, never stored as fact about the customer |
| Priority recommendation | Proposes a priority | Recomputation vs SLA policy on save |
| Summary | Concise recap for the open timeline | Picklist in composer |
| Draft reply | Candidate reply with tone guidance | Requires agent review + acknowledgement for sensitive content |
| CRM note | Pre-filled structured note | Editable, agent confirms before save |

## Approval flow (sending to a channel)

```text
AI draft produced (recorded in ai_generations)
        │
        ▼
sensitive check (PUBLIC content) ── flag found? ──► blocked: show reason, agent must acknowledge
        │ no flag
        ▼
agent reviews/edits the draft
        │
        ▼
agent confirms send (mandatory audit: SUGGESTION_USED / DRAFT_SENT)
```

## Operational guardrails

- Settings under `ai.manage`: per-feature toggles, channel restrictions, response-length caps.
- Supervisor `supervisor.ai.view`: usage and rejection metrics per team/channel, not message
  contents.
- Audit keeps every suggestion, acknowledgement and send — a reviewer can reconstruct why a
  message went out and why a suggestion was refused.
- Provider adapters are interchangeable through `AIProvider`; guardrails never live in an adapter,
  so swapping providers cannot silently drop a rule.