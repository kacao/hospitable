# Changelog

All notable changes to this SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the caveat that **while at 0.x, breaking changes land on the minor version**
(standard npm semver for pre-1.0 libraries).

## [0.5.0] — 2026-04-11

Breaking release after an empirical audit against the live Hospitable API.
Several typed models were rewritten to match reality, three new resources
(user, transactions, payouts) were added, and security was hardened with
URL encoding, `ValidationError.fields` sanitization, and business-identity
redaction. The design priorities shifted to an **agent-first** posture:
runtime errors with descriptive messages over strict types alone, JSDoc
discoverability over minimal interfaces, semantic method names over
primitive composition.

### ⚠️ Breaking changes

- **`Reservation` schema rewrite.**
  - Removed `propertyId` — the field never existed on the live API response; its presence in the type was a ghost that let agents write code assigning to undefined.
  - Added `reservationStatus: ReservationStatusObject` (new structured shape with `current.category`, `current.subCategory`, `history[]`) — the canonical way to read status going forward.
  - Added `statusHistory: ReservationLegacyStatusHistoryEntry[]` for the legacy flat format, marked `@deprecated`.
  - Existing `status: ReservationStatus` field kept, marked `@deprecated`; migration path is `reservationStatus.current.category`.
- **`Review` schema rewrite.** Old type had fictional fields (`reservationId`, `propertyId`, `guestName`, `ratings.overall`, `body`, `submittedAt`) that never existed on the real API. New shape:
  ```ts
  {
    id, platform,
    public: { rating, ratingPlatformOriginal, review, response },
    private: { feedback, detailedRatings[] },
    reviewedAt, respondedAt, canRespond,
    guest?,        // when include=guest
    reservation?,  // when include=reservation
  }
  ```
- **`Property.tags` retyped** from `PropertyTag[]` to `string[]`. The inline `tags` field on a Property is a free-text array, not the structured `{id, name}` objects returned by the separate `listTags(id)` endpoint.
- **`Property.address.countryName` is now nullable** (`string | null`). The API returns `null` in some responses.
- **`Property` added two required fields**: `roomDetails: PropertyRoomDetail[]` and `parentChild: unknown | null`. Existing consumers building `Property` fixtures in tests must populate them.
- **`reservations.list()` now requires `properties`** — the Hospitable API rejects list requests without it (`400 "The properties field is required."`). The SDK throws `ConfigurationError` locally before any HTTP request when `properties` is missing or an empty array. Same guard on `reservations.iter()` and `ReservationFilter.toParams()`.
- **`ReservationFilter.toParams()` now throws** `ConfigurationError` if `.properties([...])` was never called. Previously silently produced an invalid payload that was rejected server-side.

### ✨ Added

- **`UserResource`** — `client.user.get()` fetches the authenticated account's identity + business profile from `GET /v2/user`. Returns `User` with `id`, `email`, `name`, `business`, `company`, `vat`, `taxId`, billing address fields. Note: the API wraps this response in `{data: ...}` (unlike other single-entity endpoints); the SDK unwraps it transparently.
- **`TransactionsResource`** — `client.transactions.list()` + `.iter()` against `GET /v2/transactions`. Requires `financials:read` scope. Returns typed `Transaction[]` with `Money` amounts (`{amount, formatted, currency}`).
- **`PayoutsResource`** — `client.payouts.list()` + `.iter()` against `GET /v2/payouts`. Requires `financials:read` scope.
- **`reservations.getInHouse(propertyIds)`** — returns guests currently checked in (arrived + not yet departed). Uses `dateQuery: 'checkout'` with `startDate: today` then applies a client-side `arrivalDate <= today` filter. Returns plain `Reservation[]` (not a paginated wrapper) because the client-side filter would make pagination metadata misleading.
- **`properties.getImages(id)`** — returns `PropertyImage[]` from `GET /v2/properties/{id}/images`. **Not cached** — the URLs are pre-signed S3 with ~1h expiry.
- **`properties.search(params)`** — `GET /v2/properties/search` for availability search (distinct from `list`). Takes required `startDate`, `endDate`, `adults` plus optional `children`, `infants`, `pets`.
- **`ReservationListParams.dateQuery`**: `'checkin' | 'checkout'`. Picks which date field `startDate`/`endDate` filter against. Default is `'checkin'` server-side. Only these two literal values are accepted — anything else returns `400`.
- **`ReservationListParams.lastMessageAt`** filter. ⚠️ Format quirk: the API expects `'YYYY-MM-DD HH:MM:SS'` (space-separated, no timezone), **not** ISO 8601.
- **`'review'` is now a valid `include` on `ReservationListParams`**. Pulls the associated review alongside each reservation.
- **`ReservationFilter.dateQuery()`** and `.lastMessageAt()` fluent methods.
- **`ConfigurationError`** — thrown locally when required params are missing or malformed, before any HTTP request. Extends `HospitableError` with `statusCode: 0`. Descriptive error messages name the field and show an example call.
- **`normalizeReservation()`** helper exported from models — rewrites legacy American `canceled` → British `cancelled` in `statusHistory[].status` so agents doing `r.statusHistory.some(h => h.status === 'cancelled')` get correct results. Applied automatically by `ReservationsResource` on every response.
- **`Message` schema expansion** — new fields verified against real-world probes:
  - `platformId: string` — upstream platform's message id
  - `contentType: MessageContentType` — MIME type (currently always `'text/plain'`)
  - `attachments: MessageAttachment[]` — now typed `{type, url}` instead of `unknown[]`
  - `reactions: MessageReaction[]` — reserved (never observed populated; kept as opaque)
  - `integration: unknown | null` — third-party integration metadata
  - `sender.location: string` — sender's free-form location, e.g. `"Kippa-Ring, Australia"`
- **`MessageSource` literal union** — `'hospitable' | 'platform' | 'automated' | 'AI' | 'public_api' | (string & {})`. The `'public_api'` value tags every message the SDK itself sent — useful for agent self-audit: `thread.messages.filter(m => m.source === 'public_api')`.

### 🔒 Security

- **Path traversal prevention** — every `${id}` URL interpolation across every resource (reservations, properties, messages, reviews, inquiries, calendar — 15 sites total) now calls `encodeURIComponent()`. An attacker-supplied id of `'../../admin'` no longer resolves via `new URL()`'s dot-segment logic to a different endpoint. Regression guard: 16 tests in `src/__tests__/url-encoding-regression.test.ts`.
- **`ValidationError.fields` is sanitized at construction.** `createErrorFromResponse` now passes error bodies through `sanitize()` before storing them on the thrown `ValidationError`. Any consumer logging caught errors (Sentry, winston, etc.) no longer leaks PII or business identity from rejected payloads.
- **`sanitize()` now masks business identity fields**:
  `taxId`/`tax_id`, `vat`, `bankAccount`/`bank_account`, `streetLine1`/`street_line1`, `streetLine2`/`street_line2`, `postalCode`/`postal_code` — both camelCase and snake_case variants. Deliberate omissions documented in `src/utils/sanitize.ts`: `city`, `state`, `country`, `company`, `platformId`, and amount fields.
- **Runaway-query warnings** on `transactions.iter()` and `payouts.iter()` — the endpoints have no mandatory filter and will stream the entire account history by default. JSDoc now explicitly warns agent-driven callers to always pass `startDate`/`endDate` or `properties`.

### 🐛 Fixed

- **`getImages()` no longer caches.** Previously the 24h default properties cache TTL outlived the S3 URL signature, serving expired URLs that returned 403 Forbidden with no helpful error.
- **`fetchList()` + `list()` double-validation** — `reservations.list()` no longer calls `assertPropertiesPresent` twice on every cache miss. Validation ownership is now explicit: `list()` and `iter()` own the guard, `fetchList()` is a trusting private helper.
- **Spelling-trap warning documented in three places** on `Reservation` status fields (type-level, interface-level, field-level) so an agent inspecting any of them via LSP hover catches the `canceled`/`cancelled` inconsistency.
- **`PropertyAddress.countryName` nullability** — the API sometimes returns `null`; the type now reflects reality.

### 📝 Changed

- **README.md rewritten** for 0.5.0: new **Shapes** section with full type documentation for `Reservation`, `Review`, `Message`, `User`, `Transaction`, `Payout`; new decision table for `dateQuery` vs `getInHouse()` vs `getUpcoming()`; new canonical snippets for every new endpoint; expanded gotchas section from 10 to 22 entries.
- **`docs/PRD.md`** updated with new resources, new utilities, new security section, and refreshed test-count metric (420 across 22 files).
- **`UserResource` JSDoc** explicitly documents the `.data` envelope quirk (inconsistent with other single-entity GETs) and the deliberate no-cache decision.

### 🧪 Tests

Jumped from **340 → 420 tests** across this release. Additions:
- `src/__tests__/user.test.ts` — 7 tests including 401/404/429 error paths
- `src/__tests__/transactions.test.ts` — 7 tests including pagination `page=2` regression guard and 401/403/429 paths
- `src/__tests__/payouts.test.ts` — 6 tests covering the same surface
- `src/__tests__/url-encoding-regression.test.ts` — 16 tests, one per URL interpolation site, locking the path-traversal fix
- Status normalization test in `status-array-regression.test.ts` verifies `canceled` → `cancelled` normalization and idempotency across cached reads
- Messages snake→camel round-trip test — raw `platform_id`/`content_type`/`sender.location` payload exercised through `deepSnakeToCamel`
- `getInHouse()` boundary tests with `vi.setSystemTime` clock-locking — same-day turnover, arrival today, full-ISO arrivalDate, Z-suffix arrivalDate
- `ReservationFilter` tests cover `.dateQuery()`, `.lastMessageAt()`, and `ConfigurationError` on missing `.properties()`
- Sanitize tests cover every new business-identity field
- `ValidationError.fields` redaction regression guard in `errors.test.ts` + `http-client.test.ts`

### Migration guide (0.4.x → 0.5.0)

Quick pointers for upgrading consumer code:

1. **`reservations.list()` / `.iter()` calls** — ensure `properties: [...]` is always passed. If you want all properties, fetch `client.properties.list()` first and pass every id.
2. **`review.ratings.overall`** → `review.public.rating`. `review.body` → `review.public.review`. `review.guestName` → `review.guest?.firstName` + `review.guest?.lastName` (requires `include: 'guest'`). `review.submittedAt` → `review.reviewedAt`. `review.reservationId` / `review.propertyId` — not available on the review object; use `include: 'reservation'` to get a nested `review.reservation` summary, or fetch the reservation separately.
3. **`reservation.propertyId`** — removed; if you need a property link, fetch with `include: 'properties'` and read `reservation.properties`.
4. **`reservation.status === 'cancelled'`** — still works, but prefer `reservation.reservationStatus.current.category === 'cancelled'` for new code. The SDK normalizes `statusHistory[].status` to British spelling, so legacy iteration also works correctly now.
5. **`property.tags`** — now `string[]`. If you were typing `tag.name`, switch to the string directly.
6. **`property.address.countryName`** — may be `null`; add a nullability check.
7. **Debug logging with caught errors** — `ValidationError.fields` values for sensitive keys are now `'***'`. If you were relying on the raw value for diagnostics, read the original server error body from a request-level hook instead of the thrown error.

---

### Prior versions

Releases before `0.5.0` (`0.1.x` through `0.4.1`) predate this CHANGELOG and
are not documented here. Reference `git log` for commit-level history and
any existing ADRs in `/decisions/` for architectural decisions.

[0.5.0]: https://github.com/kacao/hospitable/releases/tag/v0.5.0
