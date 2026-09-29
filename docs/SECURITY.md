# Senami — Security

## 1. Security posture

Senami handles customer conversations that may contain sensitive personal and financial
information. It is built secure-by-default: controls fail closed, secrets live only on the server,
and every meaningful action is auditable.

This document is a design contract. Where an item is not yet implemented it says so — it is not
presented as complete.

## 2. Threat model (STRIDE)

| Threat | Example | Control |
| --- | --- | --- |
| **Spoofing** | Forged session cookie, impersonated agent | HMAC-signed session cookie, `HttpOnly`, `SameSite=Lax`, `Secure` in production, short TTL, server-side revocation |
| **Tampering** | Agent edits a sent message or audit record | Append-only message and audit writes; no update path exposed for audit events; server-side authority checks |
| **Repudiation** | "I never sent that reply" | Every meaningful action emits an audit event with actor, role, timestamp and metadata |
| **Information disclosure** | Private customer data in a public reply | First-class visibility model, composer sensitive-data screening, `AI-GUARDRAILS.md`, no secrets in client bundles |
| **Denial of service** | Credential stuffing, queue flooding | Rate limiting, request size limits, pagination caps, lockout/backoff without permanent DoS of a user |
| **Elevation of privilege** | Agent calling an admin endpoint directly | Server-side RBAC on every route; UI gating is cosmetic only |

## 3. Authentication

- Server-side sessions. The browser never holds a bearer token in JavaScript.
- Session identifier is signed (HMAC, `jose`) and stored in an `HttpOnly` cookie, so JavaScript
  cannot read it and XSS cannot exfiltrate it.
- Sessions are revocable server-side — logging out, a password change, or an admin action takes
  effect immediately, which a stateless JWT cannot guarantee.
- `SESSION_SECRET` is mandatory in production; boot fails if it is missing or under 32 characters.
  A clearly-marked ephemeral development key is used otherwise.
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, no `Domain` set.

## 4. Authorization

Authorization is a **server-side** decision made on every request. The permission catalogue and the
decision function live in one place (`server/rbac`) so that a new endpoint cannot accidentally invent
its own rules.

- Deny by default: a route with no declared permission is inaccessible.
- Role checks are additive by explicit permission, not by role-name string comparison in routes.
- Ownership scoping (an agent sees assigned work) is applied in the query layer, not in the UI.
- See `docs/RBAC.md`.

## 5. Input validation and output encoding

- Every request body, query string and path parameter is parsed with a Zod schema before it
  reaches domain logic. Unknown keys are stripped.
- Errors returned to the client contain a stable machine `code` and a safe human message — never a
  stack trace, SQL fragment or internal identifier.
- React escapes output by default. Rich content is never rendered as raw HTML without explicit
  sanitisation, and the composer screens outgoing text for sensitive patterns.

## 6. Secrets management

- `.env` files are git-ignored; only `.env.example` is committed, and it contains no values.
- Secrets are read only in `lib/env.ts` (server) and are never returned by an API, a log line or the
  health endpoint.
- AI provider credentials are server-side only and never reach the browser bundle.
- Validation errors report **keys and rules**, never the offending values.

## 7. Logging and request tracing

Every request receives a request ID (echoed in the response envelope). Logs record method, route,
status, duration, request ID and actor. They never record passwords, tokens, API keys, OTPs, PINs,
CVVs, or unnecessary customer PII.

## 8. Headers

Set in `next.config.ts` for all routes:

```text
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-DNS-Prefetch-Control: off
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

A Content Security Policy is added in Phase 3 once the asset and connection surface is known —
setting a CSP that is then immediately loosened is worse than setting it deliberately.

## 9. Data protection

- All demo data is synthetic by construction. Seed data is generated from fixed name/handle
  pools and contains no real person, account, phone number, email address, credential or
  transaction.
- The `DEMO ENVIRONMENT` indicator is rendered in the shell and provider connections display
  `● Simulated`.
- Soft deletion is used where history must be preserved; audit records are never deleted.

## 10. Current implementation status

| Control | Status |
| --- | --- |
| Strict TypeScript, no `any` in app code | Implemented (Phase 1) |
| Validated, cached environment config | Implemented (Phase 1) |
| Baseline security headers | Implemented (Phase 1) |
| Server-side sessions, revocation | Phase 4 |
| Server-side RBAC | Phase 4 |
| Rate limiting | Phase 6+ |
| Content Security Policy | Phase 3 |
| Database-backed audit, append-only | Phase 5, 14 |
| Response sensitive-data screening | Phase 7 |

## 11. Production deployment checklist

Not yet applicable — Senami has not been deployed. Before any deployment:

- [ ] `lint`, `typecheck`, `test`, `build` all pass
- [ ] TLS terminated; `Secure` cookies confirmed over HTTPS
- [ ] `SESSION_SECRET` set from a secrets manager, rotated on a schedule
- [ ] `NODE_ENV=production` and production refuses to boot without `SESSION_SECRET`
- [ ] Rate limits tuned and load-tested
- [ ] CSP verified in report-only mode, then enforced
- [ ] Database backups and restore tested
- [ ] Audit log shipped to immutable storage
- [ ] Secrets scan clean
- [ ] Preview deployment verified before production
