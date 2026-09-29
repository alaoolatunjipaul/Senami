# Senami — Product Requirements

## 1. Problem

A professional customer-service team that answers customers on social channels cannot use a
general-purpose social media management tool. Those tools optimise for publishing and analytics.
Customer service optimises for a different thing: draining a queue of unanswered humans quickly,
safely and with an auditable record.

The specific pain points Senami addresses:

1. **Channel fragmentation.** The same customer appears in comments, DMs and mentions across four
   platforms with no single thread and no single history.
2. **Public/private risk.** An agent can expose private customer information in a public reply with
   one keystroke. Social makes this materially worse than email.
3. **No accountability.** Without a durable audit trail, "who said what, when, and who approved
   it" is unanswerable after an incident.
4. **Inconsistent quality.** Tone, accuracy and policy compliance depend entirely on whoever picks
   up the conversation.
5. **Opaque performance.** Supervisors cannot see queue health, SLA exposure or agent performance
   without exporting data and building reports.

## 2. Users and roles

| Role | Purpose | Core needs |
| --- | --- | --- |
| **Agent** | Works the queue | Assigned work, fast context, safe replies, AI help, escalation |
| **Supervisor** | Runs team operations | Live queue, assignment, SLA and escalation monitoring, performance |
| **QA** | Assures quality | Review completed interactions, score, flag, coach |
| **Admin** | Operates the platform | Users, roles, teams, channels, routing, SLA policy, AI settings, audit |

Authorization is enforced server-side for every role. UI visibility is a convenience, never a
control (see `docs/RBAC.md`).

## 3. Requirements

### 3.1 Core principles

- Social support differs from email support: **public posts, public comments, mentions, replies,
  direct messages, private conversations, internal notes and escalations are distinct things** and
  must never be visually or semantically ambiguous.
- A public interaction must never be able to expose private customer information.
- The public/private distinction must be obvious at a glance.

### 3.2 Functional

| ID | Requirement |
| --- | --- |
| F1 | Unified inbox across Instagram, Facebook, X and TikTok |
| F2 | Conversation items show channel, customer, handle, preview, timestamp, type, intent, sentiment, priority, SLA state, assignee and unread state |
| F3 | Compound filters: channel, intent, sentiment, priority, status, agent, team, date, SLA — combinable, and preservable in URL state |
| F4 | Global debounced search over customer name, handle, customer ID, conversation ID, case ID and message text, grouped by Customers / Conversations / Cases |
| F5 | Conversation workspace with a timeline of public, private, internal-note and system events |
| F6 | Composer with Public Reply / Private Reply / Internal Note modes |
| F7 | Public → private transition with warning, preserved original, linked thread and audit events |
| F8 | Customer context panel: profile, segment, products, linked social accounts, recent cases, unified history |
| F9 | AI assistance: intent, sentiment, priority recommendation, suggested response, conversation summary, internal CRM note |
| F10 | AI guardrails and mandatory human review before any AI-assisted send |
| F11 | Response quality checks, including sensitive-data screening on public sends |
| F12 | Escalation with reason, team, priority and an AI-generated editable summary |
| F13 | Calculated SLA deadlines with remaining / warning / breached states |
| F14 | Agent dashboard: queue counts, response time, SLA compliance, AI-assisted rate |
| F15 | Supervisor workspace: dashboard, live queue, team conversations, escalations, SLA, AI usage, reports |
| F16 | QA workspace: review completed conversations, score against a form, flag issues, add coaching |
| F17 | Admin: users, channels, SLA policy, AI settings, categories, audit |
| F18 | System-wide audit trail of meaningful actions, immutable through the UI |
| F19 | Real-time events without full-application refresh |
| F20 | Loading, empty, error and offline states on every major screen |
| F21 | Server-side pagination, debounced search, lazy loading, list virtualisation where needed |

### 3.3 Non-functional

| ID | Requirement |
| --- | --- |
| N1 | WCAG 2.2 AA: keyboard navigation, visible focus, semantic HTML, screen-reader labels, accessible dialogs, sufficient contrast, non-colour-only status |
| N2 | Strict TypeScript; no `any` in application code |
| N3 | Secure by default: authentication, server-side authorization, input validation, output encoding, rate limiting, secure headers, least privilege, audit logging, secret management, safe errors |
| N4 | Never expose stack traces or raw backend errors |
| N5 | Every API request carries a request ID; logs exclude secrets and unnecessary PII |
| N6 | No production data. No real social credentials. No real AI keys in the repository. |
| N7 | `lint`, `typecheck`, `test` and `build` must all pass before any deployment |

## 4. Out of scope for the initial build

- Real social API integrations (mock providers only)
- Real AI provider calls (deterministic mock only)
- Production deployment
- Billing, workforce management, telephony/voice
- Native mobile applications

## 5. Acceptance criteria

The platform is accepted when the full demonstration works end to end:

```text
Login → Agent dashboard → Social inbox → Open an Instagram complaint → View customer →
View conversation history → AI identifies intent → AI identifies sentiment →
Generate response → Edit response → Review response → Send simulated response →
Audit event created → Escalate if required → Supervisor sees activity →
QA reviews conversation → QA scores interaction → Audit contains complete history
```

Every step must genuinely work. No step may be a placeholder that only looks complete, and no
mock integration may be presented as real.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Public/private leakage | Visibility modelled in data; composer screening; audited transitions |
| Queue scale | Server-side pagination, indexes, denormalised inbox fields, virtualisation |
| Automation harms quality | AI is advisory only; human review is mandatory and enforced |
| Demo mistaken for production | Persistent `DEMO ENVIRONMENT` indicator; `● Simulated` provider status |
| Security by UI only | Server-side permission checks on every mutation |
