# Senami — Roles, Permissions and Enforcement

Status: implemented in Phase 4. Source of truth: `server/rbac/permissions.ts` (catalogue and
decisions), `server/rbac/routes.ts` (route mapping), `proxy.ts` (request gate),
`server/auth/*` (sessions and sign-in), `server/auth/demo-users.ts` (synthetic accounts).

## Roles

| Role | Label | One-line description |
| --- | --- | --- |
| `AGENT` | Agent | Handles customer conversations |
| `SUPERVISOR` | Supervisor | Runs team operations and monitors queues |
| `QA` | QA Analyst | Reviews and scores completed interactions |
| `ADMIN` | Administrator | Manages the platform |

Display labels come from `lib/domain/user.ts` (`ROLE_LABELS`, `ROLE_DESCRIPTIONS`).

## Permission catalogue

Permissions are `resource.action` strings and are **deny by default**: a role holds exactly the
union listed in `rolePermissionSets`; everything else is denied even if the UI shows a control.

| Permission | Meaning | AGENT | SUPERVISOR | QA | ADMIN |
| --- | --- | :-: | :-: | :-: | :-: |
| `inbox.view` | Social inbox | ✓ | ✓ | ✓ | ✓ |
| `conversation.read` | Read conversations | ✓ | ✓ | ✓ | ✓ |
| `conversation.reply` | Reply | ✓ | | | ✓ |
| `conversation.escalate` | Escalate | ✓ | ✓ | | ✓ |
| `conversation.pause` | Pause SLA | ✓ | | | ✓ |
| `conversation.resolve` | Resolve | ✓ | | | ✓ |
| `conversation.transfer` | Transfer/assign | ✓ | | | ✓ |
| `channel.view` | Channels | ✓ | ✓ | ✓ | ✓ |
| `interaction.view` | Posts/comments/DMs | ✓ | ✓ | ✓ | ✓ |
| `case.view` | Cases | ✓ | ✓ | ✓ | ✓ |
| `performance.view` | Personal performance | ✓ | | | ✓ |
| `report.view` | Reports | | ✓ | | ✓ |
| `supervisor.queue.view` | Live queue | | ✓ | | ✓ |
| `supervisor.team.view` | Team workload | | ✓ | | ✓ |
| `supervisor.escalations.view` | Escalations | | ✓ | | ✓ |
| `supervisor.sla.view` | SLA overview | | ✓ | | ✓ |
| `supervisor.ai.view` | AI usage | | ✓ | | ✓ |
| `qa.view` | QA workspace | | ✓ | ✓ | ✓ |
| `qa.review` | Score conversations | | | ✓ | ✓ |
| `users.manage` | Users & teams | | | | ✓ |
| `channel.manage` | Channel config | | | | ✓ |
| `sla.manage` | SLA policies | | | | ✓ |
| `ai.manage` | AI settings | | | | ✓ |
| `category.manage` | Categories | | | | ✓ |
| `audit.view` | Audit log | | | | ✓ |

Notes: a supervisor can *view* QA but not score. An agent cannot see the supervisor console,
performance, or reports. Administrators have the full catalogue, which is why the admin navigation
omits Inbox and My performance (they are granted but out of an admin's workflow — see the nav model
in `lib/domain/navigation.ts`).

## Enforcement points

The UI is **never** the enforcement boundary. Order of checks per request:

1. **`proxy.ts`** — runs before any component. Verifies the session cookie signature, then:
   - `/api/*` → `401` without a session, `403` when the route permission is missing.
   - `/login` while signed in → role's home (`homePathForRole`).
   - protected page without a session → `/login`.
   - page whose route permission the role lacks → `/inbox`.
2. **Workspace layout** (`app/(workspace)/layout.tsx`) — re-reads the session server-side as a
   second line of defence behind the gate.
3. **Server actions and handlers** — `requirePermission(role, permission)` throws `ForbiddenError`
   for anything beyond route-level checks (Phase 5+ applies this per resource).
4. **API routes** (planned) — same `requirePermission` rules documented in `docs/API.md`.

Decision helpers in `server/rbac/permissions.ts`:

- `can(role, permission): boolean` — the one true decision function.
- `requirePermission(role, permission)` — assert/throw `ForbiddenError`.
- `permissionsForRole(role)` — canonical listing for tooling and tests.
- `isKnownRole(value)` — validates role input at the login boundary before a session signs.

Route mapping in `server/rbac/routes.ts`:

- `routePermissionFor(pathname)` — the permission guarding a path, or `null` (unrestricted).
- `canAccessRoute(role, pathname)` — the gate check.
- `homePathForRole(role)` — `/inbox` or `/login`.

## Sessions and sign-in

- Sessions are **server-side, signed, HttpOnly cookies** (`senami_session`, HS256, issuer/audience
  pinned). Identity is re-verified from the signature on every read — there is no trust of
  client-side flags. `proxy.ts` uses the Edge-safe module `server/auth/session-cookie.ts`;
  server components use `server/auth/session.ts`.
- Sign-in is a **server action** (`loginAsDemoUser`, form-action bound per role card) so the cookie
  can only be written by server code. Sign-out is `logoutAction`.
- In production the `SESSION_SECRET` is required (enforced by `lib/env.ts`); outside production a
  development-only key is used and is explicitly banned in production by an explicit branch.

## Demos

Phase 4 ships one canonical identity per role in `server/auth/demo-users.ts` for the demo sign-in
screen. Roles themselves are seed data for Phase 5's user store; permissions remain the same
catalogue.