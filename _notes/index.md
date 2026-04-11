---
type: project
stage: prod
project: hospitable
status: active
updated: 2026-04-11
tags: [typescript, sdk, hospitable, npm, agent-first]
---

# hospitable — Notes Index

TypeScript SDK for the **Hospitable Public API** (short-term rental property management). Abstracts OAuth2, rate-limiting, auto-retry, PII + business-identity masking, and status normalization into a single client. **Primary consumer: AI agents** — design priorities favor runtime errors with descriptive messages, JSDoc discoverability, and semantic method names (see `decisions/0002-hospitable-sdk-schema-drift-and-agent-first-design.md`). Published to npm.

**Version**: v0.5.0 (released 2026-04-11) — breaking release after empirical audit against the live API closed schema drift across every resource. Adds `UserResource`, `TransactionsResource`, `PayoutsResource`, `reservations.getInHouse()`, `properties.getImages()`, `properties.search()`, `dateQuery`/`lastMessageAt` params, URL path encoding, runtime `ConfigurationError` guards, and cancelled-spelling normalization. See `CHANGELOG.md` for the full breaking-change list.

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

- `../src/resources/` — API resource classes (properties, reservations, calendar, messages, reviews, inquiries, **user**, **transactions**, **payouts**)
- `../src/models/` — TypeScript data models for API responses
- `../src/__tests__/` — full test suite (**420 tests** across 22 files — adds `url-encoding-regression.test.ts`, `user.test.ts`, `transactions.test.ts`, `payouts.test.ts` in 0.5.0)
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

## Candidate ADRs (not yet written)

- Why tsup over tsc for dual-format build
- Release process (npm publish, changelog, versioning)
- PII masking strategy for logs

## Archive

*(none)*
