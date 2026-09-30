# Senami — Delivery Status

## Status

Phases 1–4 are delivered with lint, typecheck, unit tests and production build green.

| Phase | Scope | Commit | Gate |
| --- | --- | --- | --- |
| 1 | Foundation: repo, TypeScript, lint/format, env validation, test setup, CI, docs | `dedae95` | green |
| 2 | Design system: tokens, typography, primitives, domain types + SLA engine | `f02d6e8` | green |
| 3 | Application shell: sidebar, header, global search, notifications, profile, workspace pages | `c23c544` | green |
| 4 | Authentication & RBAC: signed HttpOnly session, demo sign-in, permission catalogue, route gate | `e797c1c` | green |

Current gate state at the end of Phase 4:

- ESLint 10: clean
- `tsc --noEmit`: clean
- Vitest: **11 files, 118 tests passing**
- `next build` (Turbopack): compiled successfully, 23 routes, proxy gate registered

## What exists today (runs locally)

- Signed session cookies (`server/auth/session-cookie.ts`, Edge-safe; `server/auth/session.ts`,
  server-only) — HS256, issuer/audience pinned, HttpOnly/SameSite=strict, TTL from
  `SESSION_TTL_SECONDS`, prod secret enforced by `lib/env.ts`.
- Demo sign-in as four synthetic roles (`server/auth/actions.ts`, `server/auth/demo-users.ts`).
- RBAC: full permission catalogue + role sets + route map (`server/rbac/*`); deny-by-default.
- Request gate `proxy.ts`: /login, protected pages, role-restricted pages, API 401/403.
- Role-scoped shell navigation, working pages for the whole workspace, demo environment banner,
  global search provider seam, React Compiler enabled.
- Design system: full token set, ~20 primitives, SLA state engine computed from policy.

## Key decisions

| Decision | Why |
| --- | --- |
| Server-side signed HttpOnly cookie over client JWT | XSS-resistant, revocable, no token in JS |
| `proxy` (Next 16) as the request gate | Route-level auth before any component renders, cheap to extend to API 401/403 |
| RBAC as a single `can(role, permission)` | One decision function, enforced server-side; UI only reflects it |
| Demo sign-in as a role picker | Spec §4/§47; passwords ship only if production build ever lands |
| Deny-by-default catalogue | Falling off a permission list means denied, never open |
| Deterministic mock providers | Demo offline, zero credentials (`docs/AI-GUARDRAILS.md`) |
| Vitest `pool: "threads"` | Forks time out on the target dev machine; occasional worker-spawn flakes are environmental and a rerun passes |

## Next up

- **Phase 5 — database (PostgreSQL + Prisma).** Plan needed before starting: there is **no local
  PostgreSQL or Docker** on the dev machine, so schema, migrations, seed (users/teams/SLA
  policies/categories/demo accounts per role) and the session-store read path must be decided up
  front. Options to resolve first: containerized Postgres, an embedded/sqlite-spike for local dev,
  or a cloud-managed instance. No speculative changes until then.
- **Phases 6+ — inbox, workspace, customers, AI, escalation, supervisor, QA, admin, audit.** Built
  on the Phase 4 auth/RBAC gate and the Prisma schema; API surface as `docs/API.md`.

## Risks

| Risk | Mitigation |
| --- | --- |
| No local PostgreSQL/Docker | Decide Phase 5 strategy before implementation |
| npm registry flakiness on this machine | Retry loop with backoff; deterministic lockfile |
| React Compiler min build time (~50 s) | Accepted; gate stays green |
| CSP currently allows `unsafe-inline` script/style | Documented hardening item in `docs/SECURITY.md` |
| Deployment | Independent repo + Vercel project, previews first, production only on explicit instruction |

## Documentation index

`PRD` · `ARCHITECTURE` · `SECURITY` · `API` · `RBAC` · `AI-GUARDRAILS` · `TESTING` · `DEMO-FLOW` —
see `README.md` for the table.