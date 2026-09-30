# Senami — Phase 5 Database Plan

Status: **planned, not implemented**. No local PostgreSQL or Docker exists on the development
machine, so this document fixes the target design and the implementation steps. Nothing here is
connected to the running application yet; the app continues to run entirely in-memory/mock until
the database step executes. The full design stays green: this document is the contract for the
implementation step.

## Goal

Replace the demo/mock data seams with a PostgreSQL store while keeping every phase's guarantee:
lint, typecheck, tests and build stay green at each step.

## Schema

`prisma/schema.prisma` models the entities from `docs/ARCHITECTURE.md` §7:

`users` · `teams` · `customers` · `social_accounts` · `channels` · `conversations` ·
`messages` · `conversation_assignments` · `cases` · `escalations` · `ai_generations` ·
`drafts` · `qa_reviews` · `sla_policies` · `notifications` · `audit_events`

Design rules already encoded:

- `created_at` / `updated_at` everywhere; no hard deletes for operational rows.
- Foreign keys declared, with covering indexes on the real query paths (queue filters,
  customer timelines, audit lookups).
- `conversations` carries denormalised `sla_*` and `last_message_*` fields because the inbox list
  is the hottest read path and must not join the whole timeline.
- `audit_events` is append-only by construction: the application exposes no update/delete path.
- `Visibility`, `MessageType`, `SlaState`, `ChannelId`, `EscalationReason*`, `QaVerdict*` are
  enums so the public/private boundary and SLA states cannot be typed wrongly.
- Channel provider settings live in `Channel.config` (JSON); platform adapters still normalise
  into the shared event shape from `docs/ARCHITECTURE.md` §5.

## Planned migration workflow

1. Install dev deps: `prisma`; runtime dep: `@prisma/client`.
2. Provision a target database (see **Runtime blockers** below).
3. `npx prisma migrate dev --name init` to create the first migration and the generated client.
4. Follow-up migrations are incremental (`--name <feature>`); CI runs
   `prisma migrate deploy` so migrations are applied, not conflicts resolved at the prompt.
5. Prisma client is instantiated once per server module and never imported by proxy.ts
   (the Edge handler relies only on `server/auth/session-cookie.ts`).

## Seed strategy

`prisma/seed.ts` (created in the implementation step) seeds a deterministic dataset:

| Seed group | Contents | Why |
| --- | --- | --- |
| Teams | Support team (EU) as a first line + escalation target teams (Billing, Legal, Social) | Escalation routing needs real `Team` rows |
| Users | The four canonical demo accounts from `server/auth/demo-users.ts` (Maya/Agent, David/Supervisor, Amara/QA, Priya/Admin) | Demo sign-in must resolve the same identities from the store |
| Channels | Instagram, Facebook, X, TikTok, all `isMock=true` | §4 simulated channels |
| SLA policies | One per priority (`lib/config.ts` `DEFAULT_SLA_MINUTES`), warning at 80% | §24 SLA engine input |
| Customers + social accounts | ~80 synthetic customers with 1–2 linked accounts each | Inbox/360 needs volume |
| Conversations/messages | ~500 conversations with messages across PUBLIC/PRIVATE boundaries, varied SLA states and priorities | Queue filters, SLA states, QA queue, audit lookups |
| Escalations/cases/QA | Realistic mixes so every workspace view has data | No blank screens (§44) |
| Audit events | A generated history per seeded action | Reconstructible trail (§29/§41) |

Seeding is idempotent (upsert on stable ids), time-stamped relative to `now()` so SLA ages look
live, and never uses the real `DATABASE_URL` by accident (a seed guard rejects non-mock targets).

## Integration points (implementation step)

| Seam today | Becomes |
| --- | --- |
| `server/auth/demo-users.ts` | Read accounts from `users`; keep the role-picker UI, resolve profile from the store |
| `server/search/search.ts` returns `[]` | Search across conversations/customers/messages |
| `lib/domain/sla.ts` | Policy rows from `sla_policies`; computed per conversation with stored denormalised state |
| `server/` feature stubs | Repositories per domain (conversations, messages, customers, escalation, qa, audit, notifications) |
| `app/api/*` (planned) | Route handlers validating via Zod, then `requirePermission`, then repository calls |

## Runtime blockers

Decide one before implementation:

1. **Docker + Postgres** on the dev machine (preferred: matches production and CI).
2. **A managed/cloud Postgres** reachable via `DATABASE_URL` (needs a connection string).
3. **Embedded SQLite spike** for local iteration only, then a final PostgreSQL migration step
   (adds a one-time translation cost; only chosen if 1 and 2 are unavailable).

No speculative installation or schema-plumbing happens until this decision is made.

## Non-goals for Phase 5

- No microservices, no read/write split, no new deployables (single Next.js app remains §2).
- No vector store or ML infra; AI stays behind the deterministic mock provider.
- No connection to any real social platform or the existing `Customer Support` repository.