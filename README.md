# Senami

**Social Customer Service & Response Management Platform**

Senami unifies public posts, comments, mentions and direct messages from social channels into a
single operational workspace for customer service teams — with SLA control, AI assistance,
escalation routing, QA scoring and a complete, immutable audit trail.

> **DEMO ENVIRONMENT** — every customer, social account, message, transaction and AI response in
> this build is **synthetic**. No real social API is connected. See `docs/DEMO-FLOW.md`.

---

## Table of contents

- [What Senami is](#what-senami-is)
- [Why social customer service is different](#why-social-customer-service-is-different)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)
- [Quality gates](#quality-gates)
- [Project layout](#project-layout)
- [Build phases](#build-phases)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## What Senami is

Senami is an enterprise-grade prototype of a social customer-service operations platform. It is
built for teams that answer customers on Instagram, Facebook, X and TikTok and need to work a
queue rather than browse a feed.

Core capabilities:

| Area | Capability |
| --- | --- |
| Inbox | Unified queue across public posts, comments, mentions and DMs, with compound filtering |
| Workspace | Per-conversation timeline with strict public / private / internal-note separation |
| Customers | Customer 360 profile, linked social accounts, unified history and cases |
| AI assistance | Intent, sentiment, priority recommendation, summary, draft reply, CRM note |
| SLA | Calculated response deadlines with warning and breach states |
| Escalation | Reason/team/priority routing with mandatory audit events |
| Supervisor | Live queue, team performance, SLA and escalation monitoring |
| QA | Scored review of completed interactions with coaching flags |
| Audit | Immutable, queryable record of every meaningful action |

## Why social customer service is different

Email support is mostly private. Social support is not. A single customer interaction may be a
**public** comment visible to everyone, and the very next message may need to become a **private
direct message**. Senami treats that boundary as a first-class, audited state transition rather
than an implementation detail:

- Every message carries an explicit visibility: `PUBLIC`, `PRIVATE`, `INTERNAL_NOTE`, `SYSTEM`.
- A public interaction can never be replied to as if it were private.
- Moving a public interaction to DM preserves the original public interaction, links the private
  thread, and writes `PUBLIC_REPLY` / `DM_STARTED` / `CASE_CREATED` audit events.
- The composer screens outgoing **public** content for sensitive data and refuses to send without
  explicit agent acknowledgement.

## Architecture

Senami is a single TypeScript codebase with a clear client/server split:

- **Frontend** — Next.js App Router, React, strict TypeScript, Tailwind CSS v4 design tokens,
  TanStack Query for server state, Zod for runtime validation at boundaries.
- **Backend** — Next.js route handlers (`app/api/**`) delegating to domain modules under
  `server/`, organised by domain: `auth`, `customers`, `conversations`, `messages`, `social`,
  `ai`, `escalation`, `qa`, `audit`, `notifications`.
- **Persistence** — PostgreSQL via Prisma (`prisma/schema.prisma`), with foreign keys, indexes,
  constraints, timestamps and soft deletion.
- **Providers** — a `SocialProvider` abstraction with deterministic mock implementations, so
  platform-specific code never leaks into the UI and real APIs can be added later without
  rewriting the application.
- **AI** — a provider-independent `AIProvider` interface with a deterministic `MockAIProvider`.
  The demo runs with no API key.

See `docs/ARCHITECTURE.md` for the full design and `docs/SECURITY.md` for the security model.

## Technology stack

**Frontend** — Next.js 16, React 19, TypeScript (strict), Tailwind CSS v4, shadcn-style Radix
primitives, Lucide icons, TanStack Query, Zod, React Hook Form.

**Backend** — Node.js, TypeScript, Next.js route handlers, Zod validation, PostgreSQL, Prisma.
Redis is used where useful and is optional.

**Quality** — ESLint 10 (flat config), Prettier, Vitest + Testing Library, V8 coverage,
GitHub Actions CI.

## Getting started

### Prerequisites

- Node.js **>= 20.9**
- npm **>= 10**
- PostgreSQL 15+ (Phase 5; the demo dataset runs without it)

### Install

```bash
npm install
```

### Configure

```bash
cp .env.example .env.local     # macOS / Linux
copy .env.example .env.local   # Windows
```

The demo runs with **no configuration at all** — mock AI and mock social providers are
deterministic and require no credentials.

### Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

See `.env.example` for the authoritative list. Summary:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | no | `Senami` | Public, non-sensitive |
| `DATABASE_URL` | Phase 5 | *(empty)* | PostgreSQL connection string |
| `REDIS_URL` | no | *(empty)* | Optional cache/queue |
| `SESSION_SECRET` | **production** | *(dev key)* | HMAC key for session cookies |
| `SESSION_TTL_SECONDS` | no | `28800` | Session lifetime |
| `AI_PROVIDER` | no | `mock` | `mock` \| `production` |
| `AI_API_KEY` | only if `AI_PROVIDER=production` | *(empty)* | Server-side only |
| `LOG_LEVEL` | no | `info` | `debug` \| `info` \| `warn` \| `error` |

Environment values are validated once with Zod (`lib/env.ts`), are never printed, and are never
returned by the health endpoint. A populated `.env` file is never committed.

## Development

```bash
npm run dev            # development server
npm run build          # production build
npm run start          # serve the production build
npm run lint           # ESLint
npm run lint:fix       # ESLint with autofix
npm run format         # Prettier write
npm run format:check   # Prettier check
npm run typecheck      # tsc --noEmit
```

## Testing

```bash
npm test               # unit + integration (Vitest, single run)
npm run test:watch     # watch mode
npm run coverage       # V8 coverage report
```

Tests are never weakened to obtain a green build. See `docs/TESTING.md`.

## Quality gates

A single command runs the full gate, in the same order as CI:

```bash
npm run verify         # lint -> typecheck -> test -> build
```

## Project layout

```text
senami/
├── app/                 # Next.js routes, layouts and API route handlers
│   └── api/             # REST API (thin: validate, authorise, delegate)
├── components/          # Design-system primitives (components/ui)
├── features/            # Feature modules (inbox, conversation, customers, ...)
├── lib/                 # Cross-cutting utilities, env, config, API client
├── server/              # Backend domain modules
│   ├── auth/  customers/ conversations/ messages/
│   ├── social/ ai/ escalation/ qa/ audit/ notifications/
├── prisma/              # schema.prisma + seed.ts
├── tests/               # unit and integration tests
├── docs/                # project documentation
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## Build phases

Senami is delivered incrementally, with lint, typecheck, test and build green at every stage.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: repo, TypeScript, lint, format, test, env, docs | Done |
| 2 | Design system: tokens, typography, primitives | Done |
| 3 | Application shell: sidebar, header, search, notifications, profile | Done |
| 4 | Authentication and RBAC | Done |
| 5–17 | Database, inbox, workspace, customers, AI, escalation, supervisor, QA, admin, audit, testing, docs, deployment | Pending |

## Deployment

Senami is a **new, independent** project. It is not connected to, and must never overwrite, the
existing `Customer Support` repository or its Vercel project. When deployment happens it will use
its own repository and its own Vercel project, and production will only be deployed on explicit
instruction. Preview deployments first.

## Documentation

| Document | Contents |
| --- | --- |
| `docs/PRD.md` | Product requirements and success criteria |
| `docs/ARCHITECTURE.md` | System design, boundaries, data flow |
| `docs/SECURITY.md` | Threat model, controls, deployment checklist |
| `docs/API.md` | REST API reference and conventions |
| `docs/RBAC.md` | Roles, permissions, enforcement |
| `docs/AI-GUARDRAILS.md` | AI safety rules and approval flow |
| `docs/DATABASE-PLAN.md` | Phase 5 PostgreSQL/Prisma schema and seed plan |
| `docs/TESTING.md` | Test strategy and suites |
| `docs/DEMO-FLOW.md` | Demo walkthrough and scenarios |
| `docs/PROJECT-SUMMARY.md` | Delivery status and decisions |
