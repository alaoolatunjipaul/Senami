# Senami — Demo Flow

Senami is a demonstration platform: every customer, social account, message, transaction and AI
response is **synthetic** (spec §5, §47). The environment label is surfaced at the top of the app;
no real social API is connected.

## Signing in

1. Open the app. The request gate (`proxy.ts`) redirects unauthenticated visitors to `/login`.
2. The login screen lists the four canonical demo accounts, one per role:
   | Role | Account | What you can do |
   | --- | --- | --- |
   | Agent | Maya Keller | Work the inbox: read/reply/escalate/pause/resolve/transfer |
   | Supervisor | David Okoro | Queue, team, escalations, SLA, AI usage, reports; view QA |
   | QA | Amara Osei | QA workspace: review and score conversations |
   | Admin | Priya Nair | Platform administration incl. users, channels, SLA, AI, audit |
3. Picking a role calls the `loginAsDemoUser` server action, which signs a strict HttpOnly
   `senami_session` cookie and lands in `/inbox`.
4. Sign out from the profile menu → clears the cookie, back to `/login`.

Because the cookie is HttpOnly and signed, reloading, closing the tab or jumping straight to a URL
keeps the session until it expires (`SESSION_TTL_SECONDS`, default 8 h). Navigating directly to a
route the role cannot open bounces to `/inbox`.

## Walkthrough by role

**Agent — Maya Keller**
Inbox → filter the queue, open a conversation, reply (the composer is Phase-work over the data
layer), transfer, escalate, pause SLA. Check **My performance**. Explore channels, interactions and
cases. Attempt to reach `/supervisor`, `/qa` or `/admin` → bounced to `/inbox`.

**Supervisor — David Okoro**
Live queue, team workload, escalations, SLA overview, AI usage, reports. QA is viewable. Inbox is
read-only (no reply/resolve). Attempt `/admin` → bounced.

**QA — Amara Osei**
QA workspace and scoring. Conversations are read-only; no operational actions. Attempt
`/supervisor/*` or `/admin` → bounced.

**Admin — Priya Nair**
Users & teams, channels, SLA policies, AI settings, categories, audit. Every permission is granted,
but the admin navigation intentionally omits Inbox and personal performance.

## What to show

1. The gate: landing on `/` or `/inbox` signed-out → login. Sign in as each role and watch the
   workspace change.
2. Access control: as Agent, open `/admin` — bounced; as Supervisor, open `/qa/scoring` — allowed.
3. Session behaviour: sign in, reload, hmm out to `/inbox` still signed in; sign out returns to
   login.
4. Demo identity: every screen carries the **DEMO ENVIRONMENT** label; search, notifications and
   profile menus are populated with synthetic data.

## Data notes

- All social channels (Instagram, Facebook, X, TikTok) are simulated providers
  (`SocialProvider` mock, Phase 6+). Real channels are added later through the same port without
  rewriting the app.
- AI assistance is a deterministic mock (`MockAIProvider`) with no API key; it follows the
  guardrails in `docs/AI-GUARDRAILS.md`.