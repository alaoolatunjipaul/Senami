# Senami — Architecture

## 1. Goals and constraints

Senami is a social customer-service operations platform. The architecture is shaped by four
constraints that dominate most design decisions:

1. **The public/private boundary is the core risk.** A single mistaken action can expose customer
   data publicly. Visibility is modelled explicitly at the data layer, not inferred at the UI.
2. **Social platforms are heterogeneous and replaceable.** Instagram, Facebook, X and TikTok have
   different concepts, payloads and capabilities. All of that must be normalised at the edge.
3. **Nothing may be a mock that lies.** Mock providers are deterministic and always labelled
   `Simulated`. A demo must never be mistakable for a live integration.
4. **Authorization is server-side.** Hiding a button is a usability affordance, never a control.

## 2. High-level shape

Senami is one TypeScript codebase deployed as a single Next.js application. This is a deliberate
choice over splitting a frontend and backend: the domain logic is identical either way, and a
single deployable removes an entire class of deployment and CORS surface for a prototype.

```text
┌───────────────────────────────────────────────────────────────────┐
│  Browser                                                          │
│  Next.js App Router pages + feature components                    │
│  TanStack Query (server state) · design-system primitives          │
└───────────────────────────────┬───────────────────────────────────┘
                                │ HTTPS, JSON, session cookie
┌───────────────────────────────▼───────────────────────────────────┐
│  Route handlers  app/api/**                                      │
│  • request id  • validation (Zod)  • authentication  • RBAC       │
│  • rate limit  • safe error mapping                               │
└───────────────────────────────┬───────────────────────────────────┘
┌───────────────────────────────▼───────────────────────────────────┐
│  Domain layer  server/**                                         │
│  auth · customers · conversations · messages · social · ai ·      │
│  escalation · qa · audit · notifications                          │
└──────────────┬───────────────────────────────┬────────────────────┘
               │                               │
┌──────────────▼─────────────┐   ┌─────────────▼───────────────────┐
│  Repositories → Prisma    │   │  Provider ports                │
│  PostgreSQL                │   │  SocialProvider (mock)         │
│  FKs · indexes · soft del  │   │  AIProvider (mock)             │
└────────────────────────────┘   └─────────────────────────────────┘
```

## 3. Layering rules

Dependencies point inwards only. A rule that keeps violations visible:

- `app/` and `components/` may import `lib/` and `features/`.
- `features/` may import `components/`, `lib/`, and **client-safe** `server/` types only.
- `server/` may import `lib/`. It must never import `components/` or `features/`.
- Domain modules must not import each other's internals; they talk through exported services or
  ports.

## 4. Domain modules

| Module | Responsibility |
| --- | --- |
| `auth` | Login, session issue/verify/revoke, role resolution |
| `rbac` | Permission catalogue and the single authorisation decision function |
| `customers` | Customer identity, social account links, 360 profile, history |
| `conversations` | Queue, filters, assignment, status transitions, case linkage |
| `messages` | Timeline writes, visibility enforcement, composer safety checks |
| `sla` | Policy resolution, deadline calculation, warning/breach derivation |
| `social` | `SocialProvider` port, normalised event model, mock providers |
| `ai` | `AIProvider` port, mock provider, guardrails, generation records |
| `escalation` | Reasons, teams, routing, escalation lifecycle |
| `qa` | Review queue, scoring, flags, coaching |
| `audit` | Append-only event log and queries |
| `notifications` | User-facing alerts derived from domain events |

## 5. Normalised social event model

Provider adapters translate platform payloads into one internal shape, so the rest of the
application never branches on platform:

```ts
interface NormalisedSocialEvent {
  channel: ChannelId;
  externalConversationId: string;
  externalMessageId: string;
  customerHandle: string;
  messageType: "POST" | "COMMENT" | "MENTION" | "REPLY" | "DIRECT_MESSAGE";
  content: string;
  occurredAt: string;   // ISO-8601
  visibility: "PUBLIC" | "PRIVATE";
  attachments: Attachment[];
}
```

The normalisation boundary is what makes §4's "real APIs later, without rewriting" achievable.

## 6. Real-time

Server-Sent Events carry domain events (`NEW_MESSAGE`, `CONVERSATION_ASSIGNED`,
`CONVERSATION_ESCALATED`, `SLA_WARNING`, `SLA_BREACHED`, `QA_COMPLETED`). The first version emits
simulated events on a timer so real-time behaviour is exercised without a live provider. The UI
patches the affected conversation rather than refetching the whole application.

## 7. Persistence

PostgreSQL via Prisma. Design rules:

- Every table has `created_at` / `updated_at`; soft-deletable tables add `deleted_at`.
- Foreign keys are declared, not implied, and child indexes cover the actual query paths
  (queue filters, customer timelines, audit lookups).
- `conversations` carries denormalised `sla_*` and `last_message_*` fields because the inbox list is
  the hottest read path and must not join the whole timeline.
- Audit events are append-only; the application exposes no update or delete path for them.

Entity list: `users`, `roles`, `teams`, `customers`, `social_accounts`, `channels`, `conversations`,
`messages`, `conversation_assignments`, `cases`, `escalations`, `ai_generations`, `drafts`,
`audit_events`, `qa_reviews`, `sla_policies`, `notifications`.

## 8. Decision log

| Decision | Rationale |
| --- | --- |
| Next.js full-stack, not a split SPA + API | Fewer deployables, no CORS surface, shared types |
| Prisma over raw SQL / Drizzle | Spec-directed, strong migrations, generated types |
| Server-side sessions (HttpOnly cookie) over JWT in JS | Instant revocation, no token in JS, XSS-resistant |
| Strict TS incl. `noUncheckedIndexedAccess` | Catches undefined at boundaries in queue code |
| Deterministic mock providers | Demo must run offline with zero credentials |
| Vitest | Native TS/ESM, fast, first-class React support |

## 9. Not yet implemented

This document describes the target architecture. Phases 1–4 deliver the foundation, design
system, application shell and authentication/RBAC. The database layer (Phase 5) and the feature
domains (Phases 6–14) are built on this design but are not yet present. `docs/PROJECT-SUMMARY.md`
tracks delivery status precisely.
