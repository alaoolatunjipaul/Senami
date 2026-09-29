# Senami — Testing

Testing is a delivery gate, not an afterthought. A test is never weakened, skipped or
reconfigured to turn a build green — a failing test is information about the code.

## 1. Command

```bash
npm test               # unit + integration, single run
npm run test:watch     # watch mode
npm run coverage       # V8 coverage to ./coverage
npm run verify         # lint -> typecheck -> test -> build
```

## 2. Stack

| Concern | Choice |
| --- | --- |
| Runner | Vitest 5 |
| DOM environment | jsdom 30 |
| Component testing | Testing Library (React) + user-event |
| Matchers | `@testing-library/jest-dom` |
| Coverage | `@vitest/coverage-v8` |

Tests live in `tests/`, mirroring the module under test. `*.test.ts` for logic, `*.test.tsx` for
components.

## 3. Principles

1. **Test behaviour, not implementation.** Assert on what a user or API consumer observes.
2. **Determinism.** No real network, no real clock dependence, no randomness without a fixed seed.
   The mock AI provider and seed data are deterministic by design so assertions are stable.
3. **Accessibility assertions matter.** Interactive components are tested for accessible name,
   keyboard operation and focus behaviour — this is where WCAG regressions actually appear.
4. **Security regression tests.** Every security control in `docs/SECURITY.md` that is implemented
   has at least one test that fails if the control is removed.
5. **No hidden skips.** Skipped tests must be justified in code and tracked, never used to
   green-build.

## 4. Test layers

### 4.1 Unit

Pure, fast, no I/O.

- **SLA calculation** — deadline computation from policy and timestamps; warning and breach
  thresholds; boundary values; `0m`, `1m`, exact-threshold cases; timezone independence.
- **RBAC** — every role against every permission; deny-by-default; unknown permission; role
  upgrade/downgrade.
- **Validation** — schemas reject malformed input, strip unknown keys, and coerce correctly.
- **Escalation rules** — reason/team/priority resolution and routing.
- **Response safety** — sensitive-pattern detection, public-vs-private screening.
- **Filtering** — compound inbox filter combination and serialisation to URL state.
- **AI guardrails** — the AI can never produce a prohibited claim; approval is required.
- **Utils** — `cn()` class merging, env parsing.

### 4.2 Integration

Against real modules with a real (test) database where persistence is involved.

- API request/response envelope, status codes, request ID propagation, error mapping.
- Authorization: forbidden responses for each role against each protected route.
- Conversation lifecycle: create, assign, message, escalate, resolve.
- Message visibility enforcement.
- Audit events written for meaningful actions and not writable by the client.
- SLA state transitions.

### 4.3 End-to-end

Playwright drives the browser through real user journeys:

```text
Login → Inbox → Open conversation → View customer → Generate AI response →
Edit → Approve → Send → Audit event
```

Plus role journeys: agent, supervisor, QA and admin — each asserting that permitted actions succeed
and prohibited ones are blocked.

## 5. Current coverage

Phases 1–4 deliver the foundation, design system, application shell and authentication/RBAC. The
test suite grows with each phase:

| Phase | Suite |
| --- | --- |
| 1 | Environment config, utilities, smoke |
| 2 | Primitives: rendering, variants, accessibility, keyboard |
| 3 | Shell: navigation, role-aware gating, search debounce, states |
| 4 | Session issue/verify/revoke, RBAC matrix, protected routes, authorization guards |

Feature-layer suites (SLA, escalation, AI, QA) are specified above and land with their phases
(5–15).

## 6. In CI

GitHub Actions runs install → lint → typecheck → test → build on every pull request and push to
`main`. A failure at any step fails the check and blocks deployment. See `.github/workflows/ci.yml`.
