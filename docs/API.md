# Senami — REST API

Status: this document defines the **conventions** and the **planned surface**. The route handlers
under `app/api/**` ship with the data phases (5–14); the authentication and authorization layer
that guards them is already live (`proxy.ts` + `server/rbac` + signed session cookies).

## Conventions

Every endpoint below follows the same rules:

| Convention | Rule |
| --- | --- |
| Transport | JSON over HTTPS. Responses are a bare resource or `{ "error": {...} }`. |
| Authentication | The signed HttpOnly session cookie `senami_session`. Never a bearer token in JS. |
| Authorization | The route-level permission gate in `proxy.ts` runs first (401 unauthenticated, 403 not entitled); handlers then call `requirePermission(role, ...)` for finer-grained per-resource checks. |
| Validation | Zod at the boundary; unknown inputs fail closed with `400`. |
| Request id | A unique `x-request-id` per request, echoed on errors for correlation with audit. |
| Error mapping | `400` validation · `401` unauthenticated · `403` forbidden · `404` missing · `409` conflict · `429` rate-limited · `500` unexpected (never leaked stack or internals). |
| Auditing | Mutations that matter (§29 policy) write an append-only `audit_events` row. |
| Pagination | Offset/limit parameters; list payloads include `total` and `hasMore`. |

## Planned endpoints

### Health

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | Liveness, no internals, never returns secrets. |

### Auth

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/auth/logout` | any signed-in | Clears the session cookie. Login is a server action (`server/auth/actions.ts`), not an API route. |

### Inbox & conversations

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/conversations` | `inbox.view` | Queue with filters (channel, status, priority, assigned, SLA state) and pagination. |
| `GET` | `/api/conversations/:id` | `conversation.read` | Timeline, customer summary, SLA state, assignment. |
| `GET` | `/api/conversations/:id/messages` | `conversation.read` | Paginated message timeline. |
| `POST` | `/api/conversations/:id/messages` | `conversation.reply` | Composer; public/private rules enforced server-side. |
| `POST` | `/api/conversations/:id/assign` | `conversation.transfer` | Assign or transfer with audit event. |
| `POST` | `/api/conversations/:id/pause` | `conversation.pause` | Pause SLA tracking with reason. |
| `POST` | `/api/conversations/:id/resume` | `conversation.pause` | Resume SLA tracking. |
| `POST` | `/api/conversations/:id/resolve` | `conversation.resolve` | Resolve a conversation. |

### Channel & interaction context

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/interactions` | `interaction.view` | Public posts/comments/mentions/DMs. |
| `GET` | `/api/channels` | `channel.view` | Channel list and health. |

### Supervisor

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/supervisor/queue` | `supervisor.queue.view` |
| `GET` | `/api/supervisor/team` | `supervisor.team.view` |
| `GET` | `/api/supervisor/escalations` | `supervisor.escalations.view` |
| `GET` | `/api/supervisor/sla` | `supervisor.sla.view` |
| `GET` | `/api/supervisor/ai` | `supervisor.ai.view` |
| `GET` | `/api/reports` | `report.view` |

### QA, admin, audit

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/qa/reviews` · `POST /api/qa/reviews` | `qa.view` / `qa.review` |
| `GET` | `/api/admin/users` · `POST/PATCH/DELETE` | `users.manage` |
| `GET` | `/api/admin/sla-policies` · `PATCH` | `sla.manage` |
| `GET` | `/api/admin/channels` · `PATCH` | `channel.manage` |
| `GET` | `/api/admin/categories` · `POST/PATCH` | `category.manage` |
| `GET` | `/api/admin/ai-settings` · `PATCH` | `ai.manage` |
| `GET` | `/api/audit` | `audit.view` |

## Security behavior at the gate (implemented)

| Request | Behavior |
| --- | --- |
| Any `/api/*` without a session | `401 {"error":"unauthorized"}` |
| `/api/*` with a session missing the route permission | `403 {"error":"forbidden"}` |
| Protected page without a session | `307` → `/login` |
| `/login` while signed in | `307` → the role's home |
| Page whose route permission the role lacks | `307` → `/inbox` |