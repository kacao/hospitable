# Changelog

All notable changes to this SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the caveat that **while at 0.x, breaking changes land on the minor version**
(standard npm semver for pre-1.0 libraries).

## [Unreleased]

Post-release review hardening. Fourteen issues opened against the 0.7.0
audit (`#42`–`#55`) are all resolved on this branch. No Public-API
breaking changes; the Connect surface gains two additions
(`onTokenExpired`, `verifyWebhookSignature`) and a tightened filter-bag
type. Error `.name` strings are now the `Hospitable*` spec names — code
that routes on `instanceof` continues to work, code that routes on
literal `err.name === 'AuthenticationError'` needs to update the string.

### ✨ Added

- **`HospitableConnectClientConfig.onTokenExpired`** (`#42`) — optional
  callback invoked on a 401 to mint a fresh token. The SDK swaps the
  token and transparently retries the failing request. Without this
  hook, 401 remains terminal (previous behavior).
- **`verifyWebhookSignature`** (`#43`) — HMAC-SHA256 verification helper
  for incoming Connect webhooks. Uses `crypto.timingSafeEqual`; supports
  `sha1`/`sha256`, hex/base64 headers, `algo=`-prefixed headers, and an
  optional timestamped scheme with `toleranceSeconds` anti-replay. Never
  throws on mismatch (DoS guard); returns `false`. Exported from the
  `Connect` namespace.
- **`HospitableForbiddenError`, `HospitableNotFoundError`,
  `HospitableConfigurationError`** — new `Hospitable*` aliases for the
  corresponding error classes. `HospitableAuthError` now catches 403
  too; see below.
- **`TokenManagerConfig.expiresIn`** (`#54`) — optional TTL (in seconds)
  for a caller-supplied `token + refreshToken`. Default is 3600 (was a
  hardcoded 60-second TTL). Pass `expiresIn: 0` to force an immediate
  refresh on the first request.
- **`Connect.collectAll`** (`#50`) — re-export of the pagination
  drain helper for namespace symmetry.

### 🐛 Fixed

- **`HospitableAuthError` covers 403** (`#45`) — `ForbiddenError` now
  extends `AuthenticationError`, so `err instanceof HospitableAuthError`
  catches both 401 and 403 per AGENTS.md spec. `ForbiddenError` keeps
  its own class for fine-grained routing.
- **Error `.name` matches the spec alias** (`#46`) — every error class
  now reports its `Hospitable*` name:
  `HospitableAuthError`, `HospitableRateLimitError`,
  `HospitableNotFoundError`, `HospitableValidationError`,
  `HospitableForbiddenError`, `HospitableServerError`,
  `HospitableConfigurationError`. `HospitableError` base unchanged.
  **Breaking only for code that compared `err.name` to the old short
  strings.** Use `instanceof` (recommended) or update the string.
- **`ConnectFilter.where(field, …)` validates `field`** (`#48`) — field
  names must match `/^[A-Za-z_][\w.]*$/`. Rejects newlines, ANSI
  escapes, brackets, ampersands — blocking a log-injection path where
  a hostile `field` value flowed into `ConfigurationError.message`. Same
  guard applies to `sortAsc`, `sortDesc`, and `select`.
- **`ConnectFilter.where` rejects commas in multi-value operators**
  (`#52`) — `is`/`not`/`between` values containing a literal comma
  previously produced ambiguous `field[is]=a,b` serialization. Now
  throw `ConfigurationError` up front so callers can split or
  normalize explicitly.
- **Connect `*ListParams` no longer accept `string[]` at the index
  signature** (`#49`) — tightening `ReservationListParams`,
  `ReviewListParams`, `TransactionListParams`, `PayoutListParams`, and
  `ResolutionListParams`. Stops a compile-time path where
  `params.page = ['oops']` was accepted via the open index, then silently
  produced NaN in `paginateConnect`.
- **`TokenManager` no longer force-refreshes caller-supplied tokens
  after 60s** (`#54`) — the default TTL is now 3600 seconds.

### 🔒 Security

- **Webhook signature verification** (`#43`) — see Added above. Before
  this release, consumers were relying on the payload type guards
  (`isConnectWebhookAction`, `isConnectWebhookFamily`) for structural
  narrowing only, with no cryptographic authentication. Production
  integrations must call `verifyWebhookSignature` before trusting the
  body.
- **Examples no longer log guest PII** (`#47`) — every sample script
  under `examples/` now masks guest names / emails per AGENTS.md
  §Safety. Copy-paste patterns are now PII-safe by default.
- **`ConnectFilter` log-injection guard** (`#48`) — see Fixed above.

### 🧪 Tests

- **Connect AGENTS.md TDD triple** (`#44`) — every endpoint across the
  10 Connect resources now has success, failure, and rate-limit tests.
  Closes a gap where 10 of the 14 new Connect suites were success-only.
- **Exponential-backoff growth assertion** (`#51`) — new test verifies
  that `withRetry` delay grows geometrically across attempts, closing a
  gap where a linear-backoff regression would have passed.
- **Realistic webhook payload fixtures** (`#53`) — per-family payloads
  replace the empty `{} as T['data']` casts. Type-guard narrowing is
  now exercised through real field access, not incidentally.
- **URL-keyed mocks in 401-refresh test** (`#55`) — `client.test.ts`
  routes mock responses by URL pattern instead of call-count arithmetic.

## [0.7.0] — 2026-04-16

Adds full **Hospitable Connect API** support alongside the existing
Public API. Connect is the partner-facing surface for multi-customer
integrations — different base URL (`connect.hospitable.com/api/v1`),
different auth (static bearer from Partner Portal, no OAuth refresh),
different rate limit (60 req/min per vendor), different pagination
shape, and a `field[operator]=value` filter syntax.

No breaking changes to the existing Public-API surface. Everything
Connect-specific lives under a new `Connect` namespace to avoid
collisions with identically-named Public types (`Reservation`, `Review`,
`Transaction`, `Payout`, etc.).

### ✨ Added

- **`HospitableConnectClient`** — new client, constructed with a
  partner-portal bearer token or the `HOSPITABLE_CONNECT_TOKEN` env var.
  Throws `ConfigurationError` when no token is available.

- **10 Connect resources** covering all 28 endpoints:
  - `authCodes.create(input)` — POST `/auth-codes` (5-min magic links
    for customer channel connection).
  - `customers.{list, create, get, delete, iter}` — partner-managed
    customers (end-users of the partner app).
  - `channels.{list, get, delete, listListings, getListing}` — OTA
    channel connections per customer.
  - `listings.{list, get, getImages, getCalendar, updateCalendar, iter}`
    — customer-scoped listings + pricing/availability calendar
    (PUT calendar accepts batch day updates).
  - `reservations.{listByListing, getByListing, listByCustomer,
    getByCustomer, iterByListing, iterByCustomer}` — both listing- and
    customer-scoped reservation queries.
  - `messaging.{listTemplates, getTemplate, send, iterTemplates}` —
    templated guest messaging (Connect does not accept freeform
    messages — `send()` requires a `templateId`).
  - `reviews.{list, iter}` — channel-scoped review queries.
  - `transactions.{list, get, iter}` (beta) — channel-scoped Airbnb
    transactions. Pre-2024-01-12 channels must re-auth to access.
  - `payouts.{list, get, iter}` (beta) — Airbnb payouts with embedded
    transaction breakdown.
  - `resolutions.{list, iter}` (beta, in development) — OTA-mediated
    dispute/claim records.

- **18 Connect model types** exported under `Connect.*`: `AuthCode`,
  `Customer`, `Channel`, `Listing` (+ `ListingImage`, `ListingCapacity`,
  `ListingRoomBed`, `ListingRoomDetails`, `ListingDetails`, `ListingFee`,
  `ListingHouseRules`, `ListingAddress`, `CalendarDay`,
  `UpdateCalendarDay`), `Reservation` (+ `ReservationStatus`,
  `ReservationStatusEntry`, `ReservationGuest`, `ReservationGuestCounts`,
  `ReservationFinancials`, `ReservationFinancialsGuest`,
  `ReservationFinancialsHost`), `Review` (+ `ReviewDetailedRating`,
  `ReviewerRole`), `Transaction`, `Payout`, `Resolution`,
  `MessageTemplate`, `MessagePlaceholder`, `SendMessageInput`,
  `Financial`, `ConnectPlatform`, `ConnectPaginatedResponse` (+ `Meta`
  and `Links`).

- **17 Connect webhook payload types** exported under `Connect.*` —
  a discriminated union on `action` covering every event family:
  - `ChannelWebhookPayload` — `channel.activated`
  - `ListingWebhookPayload` — `listing.created`, `listing.changed`,
    `listing.deactivated`, `listing.reactivated`
  - `ReservationWebhookPayload` — `reservation.created`,
    `reservation.changed`
  - `ReviewWebhookPayload` — `review.created`, `review.submitted`,
    `review.published`, `review.changed`, `review.expired`,
    `review.response_submitted`
  - `PayoutWebhookPayload` — `payout.created`, `payout.changed`
  - `TransactionWebhookPayload` — `transaction.created`,
    `transaction.changed`
  - Plus `isConnectWebhookAction(payload, action)` and
    `isConnectWebhookFamily(payload, family)` type guards.

- **`ConnectFilter`** builder (exported under `Connect.*`) — fluent,
  immutable composer for Connect's `field[operator]=value` filter
  syntax, `sort[asc|desc]=field`, `_select=`, and pagination.
  Validates operator-vs-value arity (`between` requires two values,
  `is`/`not` reject empty arrays, single-value ops reject arrays).

- **`paginateConnect`** helper — terminates on `links.next === null`,
  empty `data`, or `meta.last_page` reached (Connect's `last_page` is
  inconsistently populated, so we use layered termination).

- **`src/connect/` tree** — isolated subtree mirroring the Public SDK
  layout (`resources/`, `models/`, `webhooks/`, `client.ts`,
  `filter.ts`, `paginate.ts`). Reuses the existing `HttpClient`,
  `ConfigurationError`, and error hierarchy — no code duplication
  on the transport layer.

### 🧪 Tests

- 14 new Vitest suites under `src/__tests__/connect/` covering every
  resource, the filter builder, webhook type guards, the Connect
  paginator, and client construction/env/validation paths.


Full parity with the official Hospitable MCP server. 17 new methods
across 7 resource files close every gap between the SDK and the MCP
tool surface. A follow-up review pass added 24 error-propagation tests
and fixed 2 code issues.

### ✨ Added

- **`KnowledgeHubResource`** — new resource at `client.knowledgeHub`
  managing the per-property AI knowledge base used by Hospitable's
  automation to answer guest questions. Five methods:
  - `knowledgeHub.get(propertyUuid)` — GET full knowledge hub (topics
    with nested items + sources)
  - `knowledgeHub.createItem(propertyUuid, content, options?)` — POST
    new item, optionally into existing topic (`topicId`) or new topic
    (`topicName`)
  - `knowledgeHub.updateItem(propertyUuid, itemId, content, options?)`
    — PUT update content, optionally move to different topic
  - `knowledgeHub.deleteItem(propertyUuid, itemId)` — DELETE item
  - `knowledgeHub.deleteTopic(propertyUuid, topicId)` — DELETE topic +
    cascade items
  - IDs are numeric (not UUIDs)

- **Reservations — 6 new methods:**
  - `reservations.cancel(uuid, initiatedBy)` — POST
    `/v2/reservations/{uuid}/cancel`. `initiatedBy` is `'host' | 'guest'`.
    Only works on manual reservations.
  - `reservations.create(params)` — POST `/v2/reservations`. Creates a
    direct/manual reservation. Uses new write-side input types
    (`CreateReservationParams` with `CreateReservationFinancials`) — NOT
    the same shape as the read-side `ReservationFinancials`.
  - `reservations.update(uuid, params)` — PUT `/v2/reservations/{uuid}`.
    Same params as create minus `propertyId` and `currency`.
  - `reservations.listEnrichment(uuid)` — GET
    `/v2/reservations/{uuid}/enrichment`. Returns enrichment fields
    (key/value/description/example).
  - `reservations.getEnrichment(uuid, key)` — GET single enrichment
    field by shortcode key.
  - `reservations.updateEnrichment(uuid, key, value)` — PUT
    update/clear enrichment value. Pass `null` to clear.

- **Properties — 4 new methods:**
  - `properties.addTags(uuid, tags)` — POST
    `/v2/properties/{uuid}/tags`. Additive (doesn't replace existing).
    Accepts 1–10 tags; `ConfigurationError` guard on boundary. Clears
    the entire property cache.
  - `properties.createQuote(uuid, params)` — POST
    `/v2/properties/{uuid}/quote`. Requires "Direct" feature. Return
    typed as `unknown` (shape could not be probed). JSDoc `@returns`
    explains why and how to narrow.
  - `properties.createIcalImport(uuid, url, options?)` — POST
    `/v2/properties/{uuid}/ical-imports`. Creates external calendar feed.
  - `properties.updateIcalImport(uuid, icalUuid, options?)` — PUT
    `/v2/properties/{uuid}/ical-imports/{icalUuid}`. Can change URL,
    name, host, or force resync (only triggers if >15 min since last
    sync).

- **Transactions — 1 new method:**
  - `transactions.get(uuid, include?)` — GET `/v2/transactions/{uuid}`.
    Envelope: `{data: Transaction}`. Includes: `payout`, `reservation`.

- **Payouts — 1 new method:**
  - `payouts.get(uuid, include?)` — GET `/v2/payouts/{uuid}`.
    Envelope: `{data: Payout}`. Includes: `transactions`.

- **New model files:**
  - `src/models/knowledge-hub.ts` — `KnowledgeHub`,
    `KnowledgeHubTopic`, `KnowledgeHubItem`, `KnowledgeHubSource`,
    `KnowledgeHubProperty`, `CreateKnowledgeHubItemOptions`,
    `UpdateKnowledgeHubItemOptions`
  - `src/models/enrichment.ts` — `EnrichmentField` (`{key, value,
    description, example}`)
  - `src/models/quote.ts` — `CreateQuoteParams`, `Quote` (`unknown`)

- **Extended models:**
  - `Reservation` — `CancelReservationInitiatedBy`,
    `CreateReservationFinancials`, `CreateReservationGuest`,
    `CreateReservationGuestCounts`, `CreateReservationParams`,
    `UpdateReservationParams`
  - `Property` — `CreateIcalImportOptions`, `UpdateIcalImportOptions`
  - `Transaction` — optional `payout?`, `reservation?` include-gated
    fields
  - `Payout` — optional `transactions?` include-gated field

### 🐛 Fixed (from review)

- `updateIcalImport()` `options` parameter now defaults to `{}` so PUT
  always sends a body (previously could send an empty request).
- `createQuote()` JSDoc now has `@returns` explaining why return is
  `unknown` and how to narrow.
- `create()` normalization test fixture used `'accepted'` instead of
  `'canceled'` for the status-normalization path.

### 🧪 Tests

- **447 → 538** (+91 total: 67 initial + 24 from review)
- New test file: `src/__tests__/knowledge-hub.test.ts` (18 tests)
- Every new method has the full success/failure/rate-limit triad per
  AGENTS.md TDD policy
- 24 error-propagation tests added during review to cover all 17 new
  methods

### 🔬 Method of discovery

- MCP server audit: compared the Hospitable MCP server's 39 tools
  against the SDK surface to identify every gap
- MCP tool schemas provided authoritative input shapes for write
  endpoints whose PAT scope blocked direct probing (403)
- Read-side shapes confirmed via live API probes
- Endpoint paths confirmed empirically: 403 = path exists but needs
  scope, 404 = wrong path (e.g. `/v2/properties/{uuid}/quote` singular,
  not plural; `/v2/reservations/{uuid}/enrichment` not
  `/enrichment-data`)
- Probe script: `examples/probe-new-endpoints.ts`

---

## [0.5.4] — 2026-04-11

Schema audit against the 7 official Hospitable schema pages found three
improvement opportunities. Two fields were typed as `unknown` and one
field was missing entirely. All three are additive; shipping as a
patch-level release.

### ✨ Added

- **`ReservationFinancials` interface** — `Reservation.financials` is
  now a fully-typed structure instead of `unknown`. Full breakdown
  covers `currency`, `guest` (accommodation, averageNightlyRate, fees,
  discounts, taxes, adjustments, payments, totalPrice), and `host`
  (accommodation, accommodationBreakdown, guestFees, hostFees,
  discounts, adjustments, taxes, revenue). Every line item is a
  `ReservationFinancialLineItem` with `{amount, formatted, label,
  category}`. **⚠️ `amount` can be negative** — discounts and host
  service fees arrive as negative integers. Empirically verified
  against a real reservation: a `-$1,213.65` Early Bird Discount and a
  `-$261.07` Host Service Fee correctly preserved their sign.

- **`PropertyBookings` interface** — was typed as `unknown`, now a
  concrete structure with `fees: PropertyBookingFee[]` (`{name, type,
  value: {amount, formatted}}`), `occupancyBasedRules` (extra-guest
  and pet fees with guest-count threshold), `listingMarkups[]`
  (per-platform price markup), `bookingPolicies{cancellation[],
  paymentTerms{status, description[], gracePeriod}}`, and `siteUrls[]`.
  Empty-by-default fields (`discounts`, `securityDeposits`,
  `securityDepositCollector`) are typed as `unknown`/`unknown[]` until
  populated examples are observed.

- **`Property.icalImports?: PropertyIcalImport[]`** — new field
  previously missing from the SDK entirely. Contains external iCal
  feeds synced into the property's calendar with `{id, url, name, host,
  lastSyncAt, disconnectedAt}`. **⚠️ `icalImports[].url` is a shared
  secret** (iCal URLs embed an opaque auth token in the path) — the
  SDK does NOT redact `url` in `sanitize()` because the field name is
  too common to blanket-mask; handle it in your own logging layer.

  **Undocumented gating discovered during probe**: `icalImports` is
  populated only when `include=listings` is requested (or a
  multi-include containing `listings`). The Hospitable docs don't
  mention this — it's empirically verified. The field is `undefined`
  when `listings` isn't in the include list, not an empty array. The
  JSDoc on `Property.icalImports` explicitly documents the gating so
  agents don't assume the field is always present.

- **New exported types**: `ReservationFinancials`,
  `ReservationFinancialsGuest`, `ReservationFinancialsHost`,
  `ReservationFinancialLineItem`, `PropertyBookingFee`,
  `PropertyListingMarkup`, `PropertyOccupancyFee`,
  `PropertyOccupancyBasedRules`, `PropertyPaymentTerms`,
  `PropertyBookingPolicies`, `PropertyIcalImport`.

### 📝 Changed

- `Reservation.financials` type changed from `unknown` to
  `ReservationFinancials`. Code that was casting to access fields
  (`(r.financials as any).guest.total_price.formatted`) can now read
  them directly (`r.financials?.guest.totalPrice.formatted`). **This is
  a narrowing, not a widening** — existing `as any` casts continue to
  work; new code gets full type narrowing.
- `PropertyBookings` changed from `type PropertyBookings = unknown` to
  a structured interface. Same narrowing story — existing `as any`
  code paths still work, new code gets proper field narrowing.

### 🧪 Tests

- **447 tests** (up from 444 in 0.5.3). New coverage:
  - `status-array-regression.test.ts` → 1 test for full
    `ReservationFinancials` snake→camel round-trip with populated
    fees, discounts (negative), taxes, accommodation_breakdown, and
    host service fees
  - `properties.test.ts` → 3 new tests:
    1. `PropertyBookings` structured narrowing (replacing the old
       "opaque unknown" test)
    2. `icalImports` deserialization when `include=listings` is passed
    3. `icalImports` is `undefined` (not `[]`) when `listings` isn't
       in the include list — regression guard for the gating bug

### 🔬 Method of discovery

A new probe script `examples/probe-schemas.ts` walks every field of
the 7 schemas referenced in the Hospitable docs, dumping the full
shape of reservation, reservation financials, guest counts, guest
info, property, message, and review. Committed to `examples/` as a
reproducible audit tool. The Stoplight-hosted documentation pages
themselves return skeleton HTML to static fetchers — the only
authoritative source is the live API, probed with `include` values
and inspected field-by-field.

---

## [0.5.3] — 2026-04-11

### ✨ Added

Three `include` values were missing from the SDK that the live API
actually supports. Added after an exhaustive probe of every plausible
candidate against `/v2/reservations`, `/v2/inquiries`, and
`/v2/properties/{id}/reviews`. All three are empirically verified.

- **`reservations` now supports `include=smartlock_code`** —
  side-loads the property's smart-lock access code for the reservation
  as `reservation.smartlockCode: string | null` (typically a 4-digit
  numeric code). Populated only on accepted reservations that have a
  code assigned; `null` on cancelled/far-future/not-accepted. The
  field is deliberately **not** redacted by `sanitize()` — same
  rationale as `wifiPassword`: agents fetching this value are composing
  a check-in message and need to see the real code. The
  `smartlock_code` wire key converts to `smartlockCode` via
  `deepSnakeToCamel` on the TypeScript side. New `ReservationIncludeField`
  literal added for `PropertyFilter.include()`-style narrowing.

- **`inquiries` now supports `include=user`** — the SDK's `Inquiry`
  interface already declared `user?: InquiryUser` but the
  `InquiryIncludeField` type union was missing the `'user'` literal,
  so `client.inquiries.list({ include: 'user' })` worked at runtime
  but `InquiryFilter.include('user')` failed at compile time. The
  union is now in sync with the field, and both paths are usable.

- **`reviews` now supports `include=property`** — side-loads
  `review.property: ReviewProperty` with `{id, name, publicName}` for
  cross-property review feeds and "recent reviews across all my
  listings" displays. Useful when an agent wants to label a review
  with its property without a second API call. New `ReviewProperty`
  type exported from models.

### 📝 Changed

- **Review include JSDoc** now explicitly calls out the singular-vs-
  plural trap: `reservation` and `property` are singular; passing
  `'reservations'` or `'properties'` returns HTTP 200 with the field
  silently missing. Use `ReviewIncludeField` literal narrowing via the
  filter builder for compile-time protection.

### 🧪 Tests

- **444 tests** (up from 435 in 0.5.2). New coverage:
  - `reservations.test.ts` → 2 tests for `smartlockCode` populated + null cases
  - `status-array-regression.test.ts` → 1 test for `smartlock_code` → `smartlockCode` snake→camel round-trip via the real deserialization layer
  - `filters.test.ts` → 2 tests covering full `ReservationIncludeField` (7 values) and `InquiryIncludeField` (5 list-safe values) literal unions as compile-time regression guards — removing a literal from either union breaks the test file at compile time
  - `reviews.test.ts` → 2 tests for `include=property` deserialization and the `guest,reservation,property` combined pass-through
  - `sanitize.test.ts` → 2 tests pinning `smartlockCode` / `smartlock_code` pass-through so future sanitize pattern additions can't accidentally capture them

### 🔬 Method of discovery

A new probe script `examples/probe-all-includes.ts` scans every
plausible include value across reservations, inquiries, and reviews and
reports which ones populate fields on the response (the API silently
returns 200 for unknown includes, so field presence is the only
signal). Committed to `examples/` as a reproducible audit tool for the
next round of schema drift.

---

## [0.5.2] — 2026-04-11

### 📝 Changed

- **`wifiPassword` is no longer redacted by `sanitize()`.** Reverses the
  0.5.1 position. Rationale: Wi-Fi passwords are semi-public by design
  (hosts share them with every guest), and agents fetching
  `property.details.wifiPassword` to include in a check-in message need
  to see the real value in debug output. Masking it was over-broad
  collateral damage from the `/password/i` rule.
  - New `SAFE_OVERRIDES` allowlist in `src/utils/sanitize.ts`
    explicitly carves `wifiPassword` and `wifi_password` out of the
    sensitive-pattern match. Checked before all three redaction
    patterns.
  - Bare `password` fields (and anything matching `/password/i` that
    isn't explicitly allowlisted) are still redacted — defense-in-depth
    is preserved for hypothetical future endpoints.
  - README, `PropertyDetails` JSDoc, and `PropertyListParams.include`
    JSDoc updated to reflect the revised policy.
  - Sanitize tests flipped: `wifiPassword`/`wifi_password` now assert
    pass-through; a new test guards the bare-`password` case to ensure
    the carve-out didn't accidentally widen.

### 🧪 Tests

- **435 tests** (up from 434 in 0.5.1). Net +1:
  - 2 existing `wifiPassword` tests flipped from `.toBe('***')` to
    `.toBe('supersecret123')` (no net change in count)
  - 1 new regression guard for bare-`password` redaction

---

## [0.5.1] — 2026-04-11

### ✨ Added

- **`Property` include support.** `client.properties.list()` and
  `client.properties.get()` now accept an `include` query parameter with
  four valid values: `'user'`, `'listings'`, `'details'`, `'bookings'`.
  Previously the SDK didn't expose this even though the Hospitable API
  supports it per [the docs](https://developer.hospitable.com/docs/public-api-docs/qc4x36uhxinx3-get-properties).
  - `include=user` → populates `property.user: PropertyUser` (id, email, name, profilePicture)
  - `include=listings` → populates `property.listings: PropertyListing[]` — one entry per booking channel with `platform`, `platformId`, `coHosts[]`, etc.
  - `include=details` → populates `property.details: PropertyDetails` — host-operational info (`wifiName`, `wifiPassword`, `houseManual`, `guestAccess`, `gettingAround`, `neighborhoodDescription`, `additionalRules`, `otherDetails`, `spaceOverview`)
  - `include=bookings` → populates `property.bookings` — typed as `unknown` (opaque pricing/policy configuration object)
- **`PropertyFilter.include(...fields)`** fluent method with
  TypeScript-level narrowing via `PropertyIncludeField`. Unknown includes
  are silently ignored by the API, so this is the only fail-fast typo
  check.
- **New type exports**: `PropertyIncludeField`, `PropertyUser`,
  `PropertyListing`, `PropertyListingCoHost`, `PropertyDetails`,
  `PropertyBookings`.

### 🐛 Fixed

- **`properties.get()` envelope unwrap.** The `/v2/properties/{id}`
  endpoint wraps its response in `{data: Property}` (like `/v2/user`),
  but the SDK was typing the response as `Property` directly. Callers
  were effectively receiving `{data: Property}` at runtime with no type
  error, which meant `property.name` was `undefined` and `property.data.name`
  actually held the data. This bug was invisible to tests because mock
  responses were pre-shaped at the already-unwrapped level, never
  exercising the envelope. Discovered while adding `include` support and
  probing the real endpoint.

### 🔒 Security

- **`wifiPassword` redaction verified.** The existing `SENSITIVE_PATTERN`
  regex matches `/password/i`, so `wifiPassword` (and the snake_case
  `wifi_password` variant) on `property.details` is automatically
  redacted in debug logs and thrown `ValidationError.fields`. Added
  explicit regression tests in `sanitize.test.ts`.

### 🧪 Tests

- **434 tests** (up from 420 in 0.5.0). New coverage:
  - `properties.test.ts` → 8 new tests: `list({ include })`, `get(id, include)` signature + forwarding, cache-key separation when include differs, and include-shape deserialization for each of the four include values (`user`, `listings`, `details`, `bookings`, combined)
  - `filters.test.ts` → 5 new `PropertyFilter` tests: `.include()` method, chaining, immutability
  - `sanitize.test.ts` → 2 new regression guards verifying `wifiPassword` / `wifi_password` redaction on `property.details`
- Existing `properties.get()` tests and `cache.test.ts` mocks updated to
  wrap responses in `{data: ...}` to match the real envelope shape.

---

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

[0.6.0]: https://github.com/kacao/hospitable/releases/tag/v0.6.0
[0.5.0]: https://github.com/kacao/hospitable/releases/tag/v0.5.0
[0.5.1]: https://github.com/kacao/hospitable/releases/tag/v0.5.1
[0.5.2]: https://github.com/kacao/hospitable/releases/tag/v0.5.2
[0.5.3]: https://github.com/kacao/hospitable/releases/tag/v0.5.3
[0.5.4]: https://github.com/kacao/hospitable/releases/tag/v0.5.4
