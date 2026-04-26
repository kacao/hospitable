---
type: project
stage: prod
project: hospitable
status: active
updated: 2026-04-25
tags: [typescript, sdk, hospitable, npm, agent-first, connect-api]
---

# hospitable — Notes Index

TypeScript SDK for both **Hospitable APIs** — the host-facing Public API and the partner-facing Connect API. Single npm package, two client classes, shared transport layer (HTTP, retry, error hierarchy). **Primary consumer: AI agents** — design priorities favor runtime errors with descriptive messages, JSDoc discoverability, and semantic method names (see `decisions/0002-hospitable-sdk-schema-drift-and-agent-first-design.md`).

**Version**: v0.7.1 (released 2026-04-17) — post-release review hardening. Fourteen issues opened against the 0.7.0 audit (`#42`–`#55`) all resolved. Notable additions: `HospitableConnectClient.onTokenExpired` (mid-session token rotation), `Connect.verifyWebhookSignature` (HMAC-SHA256 with optional timestamp anti-replay), `TokenManagerConfig.expiresIn` (replaces hardcoded 60s TTL). `ForbiddenError extends AuthenticationError` so `instanceof HospitableAuthError` covers both 401 and 403. Error `.name` strings now report the `Hospitable*` spec aliases. Connect `*ListParams` index signatures tightened (no more `string[]` compile-through). 723 tests, 98% statements / 96% branches / 99% functions / 98% lines coverage.

**Unreleased (since 0.7.1)** — calendar write-path correctness pass on 2026-04-25. Discovered via spec audit that `client.calendar.update()` was serializing its body as `{ data: [...] }` since the resource was introduced (commit `2034b3c`); Hospitable's spec wraps as `{ dates: [...] }`. The endpoint returns `202 accepted` regardless of body shape, so the mismatch never threw — calendar updates were silently no-op'ing in production. Fix lands the canonical wrapper plus three previously-missing per-date fields (`closedForCheckin`, `closedForCheckout`, `note`) and a top-level `options.note` on `update()`. 727 tests (+4 new), tsc clean. Behavior change: previously-no-op'd updates will now actually apply — if you depended on no-op behavior, audit before upgrading.

**0.7.0** (2026-04-16) added full Hospitable Connect API alongside Public. `HospitableConnectClient`, 10 resource classes (28 endpoints), 18 model types, 17 webhook payload types, `ConnectFilter` builder for `field[operator]=value` syntax, `paginateConnect` helper. Connect types live under a `Connect` namespace to avoid collision with identically-named Public types. No breaking changes to the Public surface.

## Stack

- **TypeScript 5.5** strict mode
- **[tsup](https://tsup.egoist.dev/)** — dual ESM/CJS build, target ES2020, source maps on, minify off (preserves stack traces)
- **Vitest 4** + `@vitest/coverage-v8` — **95% coverage threshold** enforced for branches/functions/lines/statements (excludes models and index files)
- Async/await throughout, idiomatic TypeScript fluent builders

## Commands

```bash
npm run dev     # watch mode
npm run build   # tsup production build
npm run test    # vitest
```

Package exports `main`/`module`/`types` from `dist/`.

## Auth patterns supported

1. Personal Access Token
2. OAuth2 client credentials
3. OAuth2 refresh token flow

Auto-retry + token refresh are built into the HTTP layer.

## Key directories

- `../src/resources/` — Public API resource classes (properties, reservations, calendar, messages, reviews, inquiries, user, transactions, payouts, knowledge-hub)
- `../src/models/` — Public API TypeScript data models
- `../src/connect/` — **Connect API** subtree (added in 0.7.0):
  - `client.ts` — `HospitableConnectClient`
  - `resources/` — auth-codes, customers, channels, listings, reservations, messaging, reviews, transactions, payouts, resolutions
  - `models/` — 18 Connect data models (separate from Public to avoid name collision)
  - `webhooks/` — 17 webhook payload types + family/action type guards
  - `filter.ts` — `ConnectFilter` builder for `field[operator]=value` syntax
  - `paginate.ts` — `paginateConnect` helper (uses `links.next` instead of `meta.lastPage`)
- `../src/__tests__/` — full test suite — 14 new Connect suites under `__tests__/connect/` in 0.7.0
- `../docs/` — PRD + functional specs
- `../examples/` — usage examples + live-API probe scripts (`probe-api-surface.ts`, `probe-messages.ts`, `reservations-date-query-probe.ts` — reproducible schema-drift audits)
- `../skills/` — reserved (empty, no SKILL.md files yet)

## Key files

- [[../CLAUDE.md]] — stack / code conventions
- [[../AGENTS.md]] — TDD discipline, mock strategy, error hierarchy, documentation standards
- [[../docs/PRD.md]] — executive summary, target audience, 9 resource types
  - **P0**: properties, reservations
  - **P1**: calendar, messages
  - **P2**: reviews, inquiries, user, transactions, payouts
- [[../README.md]] — agent-first reference (method index, decision tables, shapes, gotchas)
- [[../CHANGELOG.md]] — Keep-a-Changelog format, starting at 0.5.0
- [[../package.json]] — v0.5.0, dual exports, dependencies
- `../tsup.config.ts` — build config
- `../vitest.config.ts` — 95% coverage thresholds

## Usage pattern (from README)

Idiomatic fluent filter builder:

```ts
new ReservationFilter()
  .checkinAfter('2026-01-01')
  .status('confirmed')
  .perPage(50)
```

## State

**Active, production-ready, v0.5.0 released 2026-04-11.** Recently audited end-to-end against the live Hospitable API via probe scripts in `../examples/` — the empirical audit closed schema drift in `Review`, `Reservation`, `Message`, and `Property` models, added missing endpoints (user/transactions/payouts), hardened security (URL encoding, business-identity redaction, `ValidationError.fields` sanitization), and normalized the cancelled-spelling trap. Zero TODO/FIXME clusters. Clean TDD-first architecture — AGENTS.md emphasizes mock-first development.

## Runbook

TODO: extract npm release workflow into `runbook.md`.

## Watching for

External API surface changes that would warrant SDK work but aren't yet shipped by Hospitable.

- **Tasks API (Public or Connect).** Hospitable launched Tasks as an in-app feature on 2026-03-06 (assign/coordinate/pay teammates), but the REST surface is not exposed on `developer.hospitable.com` as of 2026-04-25 — neither Public nor Connect lists a Tasks category. User feedback request open at [feedback.hospitable.com/p/task-based-reminders](https://feedback.hospitable.com/p/task-based-reminders). Trigger for SDK work: a Tasks section appears in the Hospitable Stoplight bundle, or a changelog entry announces public endpoints. When that lands, scaffold `src/resources/tasks.ts` (Public) and/or `src/connect/resources/tasks.ts` (Connect) following the existing resource-class pattern, plus models under `src/models/task.ts`.
- **Connect API multi-listing array filters.** Connect endpoints currently use single path params (`/listings/{listing}/...`) or scalar `[is]` filters. If Hospitable ever ships `listing_id[in]=a,b,c` or `listings[]` as supported filters on list endpoints, extend `ConnectFilter` accordingly.

## Candidate ADRs (not yet written)

- Why tsup over tsc for dual-format build
- Release process (npm publish, changelog, versioning)
- PII masking strategy for logs
- Tasks API gap and trigger conditions for coverage (see "Watching for" above)
- **Async-accept endpoints require round-trip probe coverage.** Calendar update silent-no-op (caught 2026-04-25) showed that read-only probes can't catch write-side body-shape drift on async-accept endpoints (those returning `202 accepted` regardless of payload validity). Probe pattern needed: `write → wait → read → assert state changed`. Currently `examples/probe-*.ts` only exercise read paths.

## Archive

*(none)*
