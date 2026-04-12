# hospitable

TypeScript SDK for the [Hospitable Public API](https://developer.hospitable.com/docs/public-api-docs/). Typed resources for properties, reservations, inquiries, calendars, messages, reviews, user/billing, transactions, and payouts. OAuth2 + PAT auth, auto-retry on 429/5xx, async-iterator pagination, PII + business-identity masking.

> **This README is written for AI coding agents.** It prioritizes exact type signatures, decision tables, and invariants over narrative. If a snippet disagrees with the source in `src/`, the source wins.
>
> **Design priorities** (agent-first): runtime errors with descriptive messages beat strict types alone, JSDoc discoverability beats minimal interfaces, semantic method names beat primitive composition, breaking changes are acceptable when they fix drift between types and API reality. See `decisions/0002-hospitable-sdk-schema-drift-and-agent-first-design.md` for the full rationale.

## Install

```bash
npm install hospitable
```

Requires Node ≥ 18. ESM and CJS both ship.

## Initialize

```ts
import { HospitableClient } from 'hospitable'
```

| Scenario | Call |
| --- | --- |
| PAT in `HOSPITABLE_API_PAT` env var | `new HospitableClient()` |
| PAT passed explicitly | `new HospitableClient({ token: 'hps_...' })` |
| OAuth2 client credentials (m2m) | `new HospitableClient({ clientId, clientSecret })` |
| OAuth2 access + refresh token | `new HospitableClient({ token, refreshToken, clientId, clientSecret })` |

Env-var resolution: `token` is read from `HOSPITABLE_API_PAT` **only** when `token` is not set in config. No other env vars are consulted. No dotenv loading — the agent/host must populate `process.env`.

### `HospitableClientConfig`

```ts
interface HospitableClientConfig {
  token?: string              // PAT or OAuth2 access token. Defaults to $HOSPITABLE_API_PAT.
  refreshToken?: string       // OAuth2 refresh token.
  clientId?: string           // OAuth2 client ID.
  clientSecret?: string       // OAuth2 client secret.
  baseURL?: string            // Default: 'https://public.api.hospitable.com'
  retry?: RetryConfig         // See "Retry & rate limiting".
  debug?: boolean             // Log requests with PII/auth masked. Default: false.
  cache?: {
    properties?:   CacheConfig  // Default: { enabled: false }
    reservations?: CacheConfig
    inquiries?:    CacheConfig
  }
}

interface CacheConfig { enabled: boolean; ttl?: number; maxSize?: number }
```

## Method index

Every callable surface. Use this as a jump table.

| Call | Signature | HTTP |
| --- | --- | --- |
| `client.properties.list` | `(params?: PropertyListParams) => Promise<PropertyList>` | `GET /v2/properties` |
| `client.properties.get` | `(id: string, include?: string) => Promise<Property>` | `GET /v2/properties/{id}` |
| `client.properties.listTags` | `(id: string) => Promise<PropertyTag[]>` | `GET /v2/properties/{id}/tags` |
| `client.properties.getImages` | `(id: string) => Promise<PropertyImage[]>` | `GET /v2/properties/{id}/images` |
| `client.properties.search` | `(params: PropertySearchParams) => Promise<PropertyList>` | `GET /v2/properties/search` |
| `client.properties.iter` | `(params?: Omit<PropertyListParams,'page'>) => AsyncGenerator<Property>` | (paginates) |
| `client.properties.clearCache` | `() => void` | — |
| `client.reservations.list` | `(params: ReservationListParams) => Promise<ReservationList>` **(properties required)** | `GET /v2/reservations` |
| `client.reservations.get` | `(id: string, include?: string) => Promise<Reservation>` | `GET /v2/reservations/{id}` |
| `client.reservations.getUpcoming` | `(propertyIds: string[], options?: { include?: string }) => Promise<ReservationList>` | `GET /v2/reservations` (status=accepted, startDate=today, dateQuery=checkin) |
| `client.reservations.getInHouse` | `(propertyIds: string[], options?: { include?: string }) => Promise<Reservation[]>` | `GET /v2/reservations` (dateQuery=checkout, startDate=today) + client-side `arrivalDate<=today` filter |
| `client.reservations.iter` | `(params: Omit<ReservationListParams,'page'>) => AsyncGenerator<Reservation>` **(properties required)** | (paginates) |
| `client.reservations.clearCache` | `() => void` | — |
| `client.inquiries.list` | `(params: InquiryListParams) => Promise<InquiryList>` **(properties required)** | `GET /v2/inquiries` |
| `client.inquiries.get` | `(uuid: string, include?: string) => Promise<Inquiry>` | `GET /v2/inquiries/{uuid}` |
| `client.inquiries.iter` | `(params: Omit<InquiryListParams,'page'>) => AsyncGenerator<Inquiry>` | (paginates) |
| `client.inquiries.clearCache` | `() => void` | — |
| `client.messages.list` | `(conversationId: string) => Promise<MessageThread>` | `GET /v2/reservations/{id}/messages` |
| `client.messages.send` | `(reservationId: string, body: string, options?: SendReservationMessageOptions) => Promise<MessageReceipt>` | `POST /v2/reservations/{id}/messages` |
| `client.messages.sendForInquiry` | `(inquiryUuid: string, body: string, options?: SendMessageOptions) => Promise<MessageReceipt>` | `POST /v2/inquiries/{uuid}/messages` |
| `client.messages.listTemplates` | `() => Promise<MessageTemplate[]>` | `GET /v2/message-templates` |
| `client.messages.sendTemplate` | `(reservationId: string, templateId: string, variables?: Record<string,string>) => Promise<Message>` | `POST /v2/reservations/{id}/messages/template` |
| `client.calendar.get` | `(propertyId: string, startDate: string, endDate: string) => Promise<CalendarData>` | `GET /v2/properties/{id}/calendar` |
| `client.calendar.update` | `(propertyId: string, updates: CalendarUpdate[]) => Promise<void>` | `PUT /v2/properties/{id}/calendar` |
| `client.calendar.block` | `(propertyId: string, startDate: string, endDate: string, reason?: string) => Promise<void>` | `POST /v2/properties/{id}/calendar/block` |
| `client.calendar.unblock` | `(propertyId: string, startDate: string, endDate: string) => Promise<void>` | `POST /v2/properties/{id}/calendar/unblock` |
| `client.reviews.list` | `(propertyId: string, params?: ReviewListParams) => Promise<ReviewList>` | `GET /v2/properties/{id}/reviews` |
| `client.reviews.respond` | `(reviewId: string, responseText: string) => Promise<Review>` | `POST /v2/reviews/{id}/respond` |
| `client.reviews.iter` | `(propertyId: string, params?: Omit<ReviewListParams,'page'>) => AsyncGenerator<Review>` | (paginates) |
| `client.user.get` | `() => Promise<User>` | `GET /v2/user` |
| `client.transactions.list` | `(params?: TransactionListParams) => Promise<TransactionList>` | `GET /v2/transactions` *(financials:read scope)* |
| `client.transactions.iter` | `(params?: Omit<TransactionListParams,'page'>) => AsyncGenerator<Transaction>` | (paginates) |
| `client.payouts.list` | `(params?: PayoutListParams) => Promise<PayoutList>` | `GET /v2/payouts` *(financials:read scope)* |
| `client.payouts.iter` | `(params?: Omit<PayoutListParams,'page'>) => AsyncGenerator<Payout>` | (paginates) |

## Decision tables

**Which send method?**

| Conversation state | Call | Why |
| --- | --- | --- |
| `reservation.id` known (booking exists) | `client.messages.send(reservation.id, body, { images?, senderId? })` | Booking endpoint; accepts image attachments. |
| `inquiry.id` known, no reservation yet (`reservation_id === null`) | `client.messages.sendForInquiry(inquiry.id, body, { senderId? })` | Pre-booking endpoint; **images not supported**. |
| You only have a conversation ID | `inquiry.id === conversation_id` — use `sendForInquiry` if no reservation, `send` otherwise. | — |

Calling the wrong endpoint → `410 Gone` or `422 Unprocessable`. TypeScript prevents passing `images` to `sendForInquiry` at compile time.

**Which read method for a thread?**

| Goal | Call |
| --- | --- |
| Get messages for a reservation or inquiry | `client.messages.list(reservationOrInquiryId)` — the resource is the reservation/conversation id |
| Get the inquiry record with its messages embedded | `client.inquiries.get(uuid, 'messages')` — `messages` include only works on `get`, not `list` |

**Which reservation date filter?**

| Goal | Call |
| --- | --- |
| Guests arriving in a window | `list({ properties, startDate, endDate, dateQuery: 'checkin' })` *(default — can omit)* |
| Guests departing in a window | `list({ properties, startDate, endDate, dateQuery: 'checkout' })` |
| Upcoming reservations (from today forward) | `getUpcoming(propertyIds)` — wrapper: status='accepted', startDate=today, dateQuery='checkin' |
| **Guests currently in-house** (arrived + not yet departed) | `getInHouse(propertyIds)` — two-filter strategy |
| Any reservation by exact ID | `get(id, include?)` |

`dateQuery` only accepts `'checkin'` or `'checkout'`. Anything else → `400`.

**Why does `getInHouse()` exist as a dedicated helper?** The Hospitable
API only accepts a single `date_query` per request, so "arrived AND not
yet departed" can't be expressed in one query. `getInHouse()` fetches
everyone whose checkout is today-or-later (via `dateQuery='checkout'`,
`startDate=today`), then filters locally for `arrivalDate<=today`. Returns
a plain `Reservation[]` (not a paginated wrapper) because the client-side
filter would make pagination metadata misleading.

## Params

### `PropertyListParams`

```ts
interface PropertyListParams {
  page?: number
  perPage?: number
  tags?: string[]
  include?: string           // comma-separated — see PropertyIncludeField
}

type PropertyIncludeField = 'user' | 'listings' | 'details' | 'bookings'
```

`include` values are verified against the live API:

- **`user`** — populates `property.user` with `{id, email, name, profilePicture}`
- **`listings`** — populates `property.listings: PropertyListing[]`, one entry per booking channel (airbnb, vrbo, direct, manual, gvr, booking_com…) with `platform`, `platformId`, `coHosts`, etc.
- **`details`** — populates `property.details: PropertyDetails` with host-operational info: `wifiName`, `wifiPassword`, `houseManual`, `guestAccess`, `gettingAround`, `neighborhoodDescription`, `additionalRules`, `otherDetails`, `spaceOverview`
- **`bookings`** — populates `property.bookings` (typed as `unknown` — opaque pricing/policy config; narrow at call site)

`include` works on both `list()` and `get()`:

```ts
// List all properties with host + listings + operational details
const { data } = await client.properties.list({
  include: 'user,listings,details',
  perPage: 100,
})

// Fetch one property with everything
const p = await client.properties.get(propertyId, 'user,listings,details,bookings')
```

Unknown `include` values are silently ignored by the API (no error
feedback for typos) — prefer `PropertyFilter.include('user', 'details')`
for TypeScript-level narrowing.

`details.wifiPassword` is deliberately **not** redacted by `sanitize()`.
It's semi-public by design (hosts share it with every guest), and
agent workflows typically read it to include in a check-in message.
If you need it redacted in a specific context, filter at your log
boundary rather than relying on SDK-level masking.

### `PropertySearchParams`

Availability search — distinct from `list` in that only properties that can
host the given window and party size appear.

```ts
interface PropertySearchParams {
  startDate: string   // ISO YYYY-MM-DD — REQUIRED
  endDate: string     // ISO YYYY-MM-DD — REQUIRED
  adults: number      // REQUIRED
  children?: number
  infants?: number
  pets?: number
  page?: number
  perPage?: number
}
```

All three of `startDate`, `endDate`, and `adults` are required by the API.
Missing any returns `400`.

### `ReservationListParams`

```ts
interface ReservationListParams {
  properties: string[]                            // REQUIRED by the API
  startDate?: string                              // ISO YYYY-MM-DD
  endDate?: string                                // ISO YYYY-MM-DD
  dateQuery?: 'checkin' | 'checkout'              // default: 'checkin' server-side
  lastMessageAt?: string                          // 'YYYY-MM-DD HH:MM:SS' (not ISO 8601!)
  status?: ReservationStatus | ReservationStatus[]
  include?: string                                // comma-separated — see ReservationIncludeField
  page?: number
  perPage?: number
}

type ReservationStatus =
  | 'not_accepted' | 'request' | 'accepted' | 'cancelled' | 'checkpoint'

type ReservationDateQuery = 'checkin' | 'checkout'

type ReservationIncludeField =
  | 'guest' | 'user' | 'financials' | 'listings' | 'properties' | 'review' | 'smartlock_code'
```

- **`properties` is required.** The SDK throws `ConfigurationError` locally before the HTTP call if it's missing or an empty array — see [Gotchas](#gotchas-read-this).
- **`dateQuery`** picks which date field `startDate`/`endDate` filter against. Defaults to `'checkin'` server-side. Use `'checkout'` for "guests still in-house" or "departing in this window" queries. Only `'checkin'` and `'checkout'` are valid — anything else returns `400`.
- **`lastMessageAt` format quirk**: the API expects `YYYY-MM-DD HH:MM:SS` (space-separated, no timezone), **not ISO 8601**.
- **`include=review`** fetches the review associated with each reservation alongside the reservation itself — useful for batch review-status audits.
- **`include=smartlock_code`** side-loads the property's smart-lock access code for this reservation as `reservation.smartlockCode` (string, typically a 4-digit numeric code, or `null` for cancelled/far-future reservations). Not redacted by `sanitize()` — agents need to include the code in guest check-in messages, same semantic as `wifiPassword` on a property's `details`.
- `status` may be passed as a string or array; the SDK always serializes as an array.

### `TransactionListParams` / `PayoutListParams`

```ts
interface TransactionListParams {
  startDate?: string    // ISO YYYY-MM-DD
  endDate?: string      // ISO YYYY-MM-DD
  properties?: string[]
  page?: number
  perPage?: number
}

interface PayoutListParams {
  startDate?: string    // ISO YYYY-MM-DD
  endDate?: string      // ISO YYYY-MM-DD
  properties?: string[]
  page?: number
  perPage?: number
}
```

⚠️ **Always pass bounds for agent workflows.** Both endpoints accept no-param calls, which stream the account's entire financial history — see [Gotchas](#gotchas-read-this).

### `InquiryListParams`

```ts
interface InquiryListParams {
  properties: string[]              // REQUIRED by the API
  include?: string                  // comma-separated subset of InquiryIncludeField (minus 'messages')
  lastMessageAt?: string            // ISO 8601 datetime
  page?: number
  perPage?: number
}

type InquiryIncludeField =
  | 'financials' | 'guest' | 'user' | 'properties' | 'listings' | 'messages'
```

Valid `include` values on **list**: `financials`, `guest`, `user`, `properties`, `listings`. The `messages` include is **only** supported on `client.inquiries.get` — the list endpoint rejects it with `400 "You cannot include messages when fetching all inquiries"`.

### `ReviewListParams`

```ts
interface ReviewListParams {
  responded?: boolean
  include?: string          // e.g. 'guest,reservation,property'
  page?: number
  perPage?: number
}

type ReviewIncludeField = 'guest' | 'reservation' | 'property'
```

Pass `include: 'guest,reservation,property'` to side-load:

- **`review.guest`** — first/last name, language (minimal — no PII beyond that)
- **`review.reservation`** — `{id, code, checkIn, checkOut}` summary for cross-reference
- **`review.property`** — `{id, name, publicName}` summary, useful for building cross-property review feeds

⚠️ `reservation` and `property` are **singular** include values. Passing
`'reservations'` or `'properties'` (plural) returns HTTP 200 with the
field silently missing — the API silent-ignores unknown includes, so
use the `ReviewIncludeField` literal union via the filter builder for
compile-time protection.

Unknown `include` values are silently ignored by the API — don't rely
on error feedback for typos.

## Shapes

### `Reservation`

The reservation object exposes status in **three** fields to cover the
API's evolution. See the [Gotchas](#gotchas-read-this) section for the
spelling trap.

```ts
interface Reservation {
  id: string
  code: string
  platform: ReservationPlatform
  platformId: string
  bookingDate: string
  arrivalDate: string        // ISO — may include timezone offset
  departureDate: string
  checkIn: string
  checkOut: string
  nights: number
  stayType: string
  ownerStay: boolean | null

  // Status — prefer `reservationStatus` in new code
  reservationStatus: {
    current: { category: ReservationStatus; subCategory: string | null }
    history: Array<{
      category: ReservationStatus
      subCategory: string | null
      changedAt: string
    }>
  }
  /** @deprecated use reservationStatus.current.category */
  status: ReservationStatus
  /** @deprecated use reservationStatus.history. SDK normalizes
   *  american 'canceled' → british 'cancelled' on every response. */
  statusHistory: Array<{
    category: string
    status: string         // normalized to british spelling by the SDK
    changedAt: string
  }>

  guests: ReservationGuests
  guest?: Guest              // only when include=guest
  user?: ReservationUser     // only when include=user
  financials?: unknown       // only when include=financials
  properties?: unknown[]     // only when include=properties
  listings?: unknown[]       // only when include=listings
  review?: unknown | null    // only when include=review
  smartlockCode?: string | null   // only when include=smartlock_code; 4-digit numeric code or null

  notes: string | null
  conversationId: string
  conversationLanguage: string | null
  lastMessageAt: string | null
  issueAlert: unknown
}
```

### `Review`

Reviews are split into public (what the guest posted on the platform)
and private (host-only feedback not shown to other guests).

```ts
interface Review {
  id: string
  platform: string
  public: {
    rating: number                    // integer 1-5
    ratingPlatformOriginal: string    // platform's native format, e.g. "5.00"
    review: string                    // guest's public review text
    response: string | null           // host's public response, if any
  }
  private: {
    feedback: string | null           // host-only private note
    detailedRatings: Array<{
      type: 'value' | 'cleanliness' | 'communication' | 'location'
          | 'checkin' | 'accuracy' | 'facilities' | 'staff' | 'services'
          | (string & {})
      rating: number                  // 0-5; 0 means category not collected
      comment: string | null
    }>
  }
  reviewedAt: string                  // ISO — when guest submitted
  respondedAt: string | null          // ISO — when host responded
  canRespond: boolean                 // false after platform response window closes

  guest?: {                           // only when include=guest
    firstName: string
    lastName: string
    language: string
  }
  reservation?: {                     // only when include=reservation
    id: string
    code: string
    checkIn: string
    checkOut: string
  }
  property?: {                        // only when include=property
    id: string
    name: string                      // host-facing internal name
    publicName: string                // public-facing listing name
  }
}
```

### `Message`

```ts
interface Message {
  id: number | string
  platform: string
  platformId: string                  // upstream platform's message id
  conversationId: string
  reservationId: string
  contentType: 'text/plain' | (string & {})
  body: string
  attachments: Array<{                // typed — NOT opaque
    type: 'image' | (string & {})
    url: string                       // ⚠️ pre-signed S3, ~1h expiry. DO NOT CACHE.
  }>
  reactions: unknown[]                // never observed populated
  senderType: 'host' | 'guest' | (string & {})
  senderRole: string | null
  sender: {
    firstName: string
    fullName: string
    locale: string
    pictureUrl: string | null
    thumbnailUrl: string | null
    location: string                  // e.g. 'Kippa-Ring, Australia'; empty for hosts
  }
  createdAt: string
  source: 'hospitable' | 'platform' | 'automated' | 'AI' | 'public_api' | (string & {})
  integration: unknown | null
  sentReferenceId: string | null      // match against MessageReceipt.sentReferenceId
}
```

**Observability trick**: `source === 'public_api'` tags every message the
SDK itself sent. Filter on it to see your own agent's sends vs. everyone
else's:

```ts
const thread = await client.messages.list(reservationId)
const mySends = thread.messages.filter(m => m.source === 'public_api')
```

### `Property` (when includes are requested)

```ts
interface Property {
  // ... core fields (id, name, address, capacity, amenities, etc.)

  // Include-gated fields, populated only when the matching `include=` value is passed:
  user?: PropertyUser                 // include=user
  listings?: PropertyListing[]        // include=listings
  details?: PropertyDetails           // include=details
  bookings?: PropertyBookings         // include=bookings
}

interface PropertyUser {
  id: string
  email: string
  name: string
  profilePicture: string | null
}

interface PropertyListing {
  platform: string                    // 'airbnb' | 'vrbo' | 'direct' | 'manual' | ...
  platformId: string
  platformUserId: string | null
  platformPicture: string | null
  platformName: string | null
  platformEmail: string | null
  coHosts: Array<{
    userId: string
    name: string
    channelName: string
  }>
}

interface PropertyDetails {
  additionalRules: string | null
  gettingAround: string | null
  guestAccess: string | null
  houseManual: string | null
  neighborhoodDescription: string | null
  otherDetails: string | null
  spaceOverview: string | null
  wifiName: string | null
  wifiPassword: string | null         // passed through sanitize() unchanged
}

type PropertyBookings = unknown       // opaque; narrow at call site
```

### `User`

```ts
interface User {
  id: string
  email: string
  name: string
  profilePicture: string | null
  business: boolean
  company: string | null
  vat: string | null
  taxId: string | null
  streetLine1: string | null
  streetLine2: string | null
  postalCode: string | null
  city: string | null
  state: string | null
  country: string | null
}
```

### `Transaction` / `Payout`

```ts
interface Money {
  amount: number        // minor currency units (cents for USD)
  formatted: string     // pre-formatted, e.g. "$191.48"
  currency: string      // ISO 4217
}

interface Transaction {
  id: string
  platform: string
  type: string          // 'Payout' | 'Rent' | 'Refund' | 'Adjustment' | ...
  details: string | null
  reference: string | null
  currency: string
  amount: number | null           // null when paidOutAmount is used instead
  paidOutAmount: Money | null
  date: string                    // ISO 8601
  startDate: string | null
}

interface Payout {
  id: string
  platform: string
  platformId: string              // platform's payout id (e.g. Airbnb's "G-...")
  bankAccount: string             // display, e.g. "Checking ••4169 (USD)"
  reference: string | null
  amount: Money
  date: string                    // ISO 8601
}
```

## Filters

Immutable fluent builders. Terminal call: `.toParams()`.

| Filter | Chainable methods |
| --- | --- |
| `PropertyFilter` | `.tags(string[])`, `.include(...PropertyIncludeField)`, `.perPage(n)` |
| `ReservationFilter` | `.properties(ids)` **required**, `.checkinAfter(date)`, `.checkinBefore(date)`, `.dateQuery('checkin'\|'checkout')`, `.lastMessageAt('YYYY-MM-DD HH:MM:SS')`, `.status(ReservationStatus \| ReservationStatus[])`, `.include(...ReservationIncludeField)`, `.perPage(n)` |
| `InquiryFilter` | `.properties(ids)` **required**, `.include(...InquiryIncludeField)`, `.lastMessageAfter(datetime)`, `.page(n)`, `.perPage(n)` |

Both `ReservationFilter.toParams()` and `InquiryFilter.toParams()` **throw `ConfigurationError` at runtime** if `.properties()` was never called — the underlying endpoints reject the request otherwise.

```ts
import { ReservationFilter, InquiryFilter } from 'hospitable'

const params = new ReservationFilter()
  .properties([propertyId])            // required — throws without it
  .checkinAfter('2026-01-01')
  .checkinBefore('2026-12-31')
  .dateQuery('checkout')               // optional — default 'checkin'
  .status(['accepted', 'request'])
  .include('guest', 'properties', 'review')
  .perPage(50)
  .toParams()

await client.reservations.list(params)
```

## Canonical snippets

### List all properties

```ts
for await (const p of client.properties.iter()) {
  // p: Property — one at a time, memory-safe
}
```

### Upcoming reservations for specific listings

```ts
const { data } = await client.reservations.getUpcoming(
  ['prop-uuid-1', 'prop-uuid-2'],
  { include: 'guest,properties' },
)
```

`getUpcoming` is a thin wrapper — it calls `list` with `status='accepted'`, `startDate=today`, `dateQuery='checkin'`, and the given `properties`.

### Guests currently in-house

```ts
const inHouse = await client.reservations.getInHouse(
  ['prop-uuid-1', 'prop-uuid-2'],
  { include: 'guest,properties' },
)
// inHouse: Reservation[] — NOT a paginated wrapper, because this method
// applies a client-side arrivalDate filter that would break pagination
// metadata.
for (const r of inHouse) {
  console.log(`${r.guest?.firstName} ${r.guest?.lastName} — checks out ${r.departureDate.slice(0,10)}`)
}
```

### Generate a check-in message with wifi + door code

```ts
// Fetch both the property (for wifi) and the reservation (for smart lock code)
const { data: reservations } = await client.reservations.list({
  properties: [propertyId],
  status: 'accepted',
  startDate: today,
  include: 'guest,smartlock_code',
  perPage: 1,
})
const r = reservations[0]!

const property = await client.properties.get(propertyId, 'details')

const message = [
  `Hi ${r.guest?.firstName}! Welcome to your stay.`,
  `Wifi: ${property.details?.wifiName} / ${property.details?.wifiPassword}`,
  `Door code: ${r.smartlockCode ?? '(will send closer to arrival)'}`,
].join('\n')

await client.messages.send(r.id, message)
```

Neither `wifiPassword` nor `smartlockCode` is redacted by the SDK's
`sanitize()` helper — both are shareable credentials that agents
legitimately need in debug output. See [Gotchas](#gotchas-read-this).

### Check a property's availability

```ts
const { data } = await client.properties.search({
  startDate: '2026-07-01',
  endDate:   '2026-07-07',
  adults:    2,
  children:  1,
})
// Only properties that can host those dates + party size appear.
```

### Fetch property photos

```ts
const images = await client.properties.getImages('prop-uuid')
// images[i].url is pre-signed S3 with ~1h expiry. Do not cache it.
```

### Fetch properties with host + operational details

```ts
// Single property with everything side-loaded
const p = await client.properties.get(propertyId, 'user,listings,details,bookings')

console.log(`Host: ${p.user?.name} <${p.user?.email}>`)
console.log(`Platforms: ${p.listings?.map(l => l.platform).join(', ')}`)
console.log(`Wifi: ${p.details?.wifiName}`)

// All properties at once, just with host info
const { data } = await client.properties.list({
  include: 'user',
  perPage: 100,
})
for (const prop of data) {
  console.log(`${prop.name} is hosted by ${prop.user?.name}`)
}
```

Combine with `PropertyFilter` for TypeScript-level typo protection:

```ts
import { PropertyFilter } from 'hospitable'

const params = new PropertyFilter()
  .include('user', 'listings', 'details')   // typed — 'bookngs' would fail at compile
  .perPage(50)
  .toParams()

const { data } = await client.properties.list(params)
```

### Fetch an inquiry with its thread

```ts
const inquiry = await client.inquiries.get(uuid, 'guest,properties,messages')
inquiry.property   // === inquiry.properties  (aliased by normalizeInquiry)
inquiry.messages   // Message[] — requires include='messages'
```

### Reply to a pre-booking inquiry

```ts
const receipt = await client.messages.sendForInquiry(
  inquiry.id,
  'Thanks for asking — those dates are available.',
)
// receipt.sentReferenceId : use to correlate with messages fetched later
```

### Reply to a booking with an image

```ts
await client.messages.send(reservation.id, 'Here is the gate code.', {
  images: ['https://example.com/gate.jpg'],
  senderId: 'cohost-user-id',   // omit to send as listing owner
})
```

### Calendar block + price override

```ts
await client.calendar.block('prop-uuid', '2026-07-01', '2026-07-07', 'Owner stay')

await client.calendar.update('prop-uuid', [
  { date: '2026-07-15', price: { amount: 20000 }, available: false },
  { date: '2026-07-16', price: { amount: 22000 }, available: true, minStay: 3 },
])
```

Dates are always ISO `YYYY-MM-DD`. `update` merges additively with existing calendar state.

### Respond to unanswered reviews

```ts
for await (const review of client.reviews.iter('prop-uuid', { responded: false })) {
  await client.reviews.respond(review.id, 'Thank you for your feedback!')
}
```

### Collect a small list into an array

```ts
import { collectAll } from 'hospitable'

const all = await collectAll(
  client.reservations.iter({
    properties: propertyIds,                // required
    startDate: '2026-01-01',
  }),
)
```

### Who am I?

```ts
const me = await client.user.get()
console.log(`${me.name} (${me.email})`)
if (me.business) {
  console.log(`Business: ${me.company}, Tax ID: ${me.taxId}`)
}
```

### Financial reporting — always pass bounds

```ts
// A reporting window — scope transactions and payouts with date ranges
// so you never accidentally stream the entire account history.
const start = '2026-01-01'
const end   = '2026-03-31'

const transactions = await collectAll(
  client.transactions.iter({ startDate: start, endDate: end }),
)
const payouts = await collectAll(
  client.payouts.iter({ startDate: start, endDate: end }),
)

const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount.amount, 0)
console.log(`Paid out Q1: $${(totalPaidOut / 100).toFixed(2)}`)
```

⚠️ **Do not** call `collectAll(client.payouts.iter())` with no params — it
will stream the account's entire history. See
[Gotchas](#gotchas-read-this).

### Review with guest + reservation included

```ts
for await (const review of client.reviews.iter('prop-uuid', {
  include: 'guest,reservation',
})) {
  const name = review.guest ? `${review.guest.firstName} ${review.guest.lastName}` : 'Anonymous'
  console.log(`${name}: ${review.public.rating}/5 "${review.public.review}"`)
  if (review.private.feedback) {
    console.log(`  (private feedback: ${review.private.feedback})`)
  }
}
```

## Pagination

Every list resource exposes `iter()` — async-generator auto-pagination. Pull one item at a time; the generator fetches new pages lazily.

```ts
for await (const r of client.reservations.iter({ startDate: '2026-01-01' })) {
  // stop at any time — no further pages are fetched
  if (r.status === 'accepted') break
}
```

Helpers from the `paginate` / `collectAll` exports are also available if you need to drive pagination manually against a custom `PageFetcher`.

## Async message delivery

Both `send` and `sendForInquiry` return **202 Accepted** with a `MessageReceipt`:

```ts
interface MessageReceipt { sentReferenceId: string }
```

Delivery happens out-of-band on the upstream channel (Airbnb, VRBO, Booking.com, direct). To confirm a message actually landed:

1. Persist `receipt.sentReferenceId` after the send.
2. Poll `client.messages.list(conversationId)` later.
3. Match against each `Message.sentReferenceId` — when it appears, delivery succeeded.

Rate limits (both endpoints): **2/minute per target conversation**, **50 per 5 minutes globally**. 429s are retried automatically by the retry layer.

## Errors

Every failure mode is a typed subclass of `HospitableError`. Use `instanceof` for narrowing.

| Class | `statusCode` | Extra fields |
| --- | --- | --- |
| `ConfigurationError` | `0` (no HTTP made) | — |
| `AuthenticationError` | `401` | — |
| `ForbiddenError` | `403` | — |
| `NotFoundError` | `404` | `resource?: string` |
| `ValidationError` | `422` | `fields: Record<string, string[]>` |
| `RateLimitError` | `429` | `retryAfter: number` (seconds) |
| `ServerError` | `5xx` | `attempts: number` |
| `HospitableError` | any | `statusCode: number`, `requestId?: string` (base class) |

All subclasses inherit `statusCode` and `requestId`. `ConfigurationError` is thrown **before** any network request is made — used when required params are missing locally (e.g. `reservations.list({})` without `properties`). `statusCode: 0` distinguishes it from HTTP errors in catch blocks.

```ts
import {
  HospitableError, ConfigurationError,
  AuthenticationError, ForbiddenError,
  NotFoundError, ValidationError, RateLimitError, ServerError,
} from 'hospitable'

try {
  await client.reservations.list({ properties: [propertyId] })
} catch (err) {
  if (err instanceof ConfigurationError)  return console.error(`Bad call: ${err.message}`)
  if (err instanceof NotFoundError)       return null
  if (err instanceof ValidationError)     console.error(err.fields)
  if (err instanceof RateLimitError)      console.warn(`retry in ${err.retryAfter}s`)
  if (err instanceof AuthenticationError) throw new Error('bad token')
  if (err instanceof ForbiddenError)      throw new Error('insufficient permissions')
  if (err instanceof ServerError)         throw new Error(`5xx after ${err.attempts} attempts`)
  if (err instanceof HospitableError)     throw new Error(`${err.statusCode}: ${err.message}`)
  throw err
}
```

Non-obvious:

- **The SDK's retry layer already handles 429 and 5xx transparently.** A `RateLimitError` reaching user code means retries were exhausted — do not wrap it in another retry loop.
- **`ValidationError.fields` is automatically sanitized.** Sensitive keys (`email`, `firstName`, `taxId`, `bankAccount`, etc.) are replaced with `'***'` before the error is thrown. A caught error shipped to Sentry/winston won't leak PII or business identity. See [Debug logging](#debug-logging) for the full field list.

## Retry & rate limiting

```ts
interface RetryConfig {
  maxAttempts?: number            // default 4 (includes initial attempt)
  baseDelay?: number              // default 1000 ms
  maxDelay?: number               // default 60_000 ms
  onRateLimit?: (info: {
    retryAfter: number
    endpoint: string
    attempt: number
  }) => void
}
```

Backoff is jittered exponential, capped at `maxDelay`. 401 triggers a silent OAuth refresh and a single retry when `refreshToken` + `clientId` + `clientSecret` are configured. On successful re-auth, all resource caches are cleared automatically.

```ts
new HospitableClient({
  token,
  retry: {
    maxAttempts: 4,
    baseDelay: 1000,
    maxDelay: 60_000,
    onRateLimit: ({ retryAfter, endpoint, attempt }) => {
      console.warn(`ratelimit ${endpoint} attempt=${attempt} retryAfter=${retryAfter}s`)
    },
  },
})
```

## Caching

Opt-in per-resource in-memory cache. Only `properties`, `reservations`, and `inquiries` are cacheable. Keys are derived from the full request params. The cache is cleared automatically when the client performs a 401 → refresh cycle.

**Deliberately NOT cached:**

- `properties.getImages()` — returns pre-signed S3 URLs with ~1h expiry. A 24h cache would serve URLs that return 403 Forbidden.
- `user.get()` — business profile changes rarely but not never; no cache to avoid stale identity on account edits.
- `transactions` / `payouts` — financial data should always reflect the latest state; caching could mask just-posted rows.
- `messages` — conversation state is dynamic; stale message threads are worse than useless.

```ts
new HospitableClient({
  token,
  cache: {
    properties:   { enabled: true, ttl: 86_400_000 },  // 24 h — properties change rarely
    reservations: { enabled: true, ttl: 60_000     },  //  1 m — reservations move
    inquiries:    { enabled: true, ttl: 60_000     },  //  1 m
  },
})

// manual invalidation
client.properties.clearCache()
client.reservations.clearCache()
client.inquiries.clearCache()
```

Default TTLs if `enabled: true` but `ttl` is omitted: `properties` 24h, `reservations` 1m, `inquiries` 1m.

## Debug logging

```ts
new HospitableClient({ token, debug: true })
```

Logs each request: method, URL, params, request/response bodies. Sanitization runs recursively over any object before it hits the log stream or a caught `ValidationError.fields`. Three categories are masked:

- **Guest PII**: `email`, `phone`, `phoneNumbers`, `firstName`, `lastName`, `fullName`, `dateOfBirth`, `guestName`, `displayName`, `hostName`, `passportNumber`, `senderId`
- **Credentials**: anything matching `token`, `secret`, `password`, `credential`, `apiKey`, `api_key`, `authorization`
- **Business identity** (financial + address fine-grained): `taxId`/`tax_id`, `vat`, `bankAccount`/`bank_account`, `streetLine1`/`street_line1`, `streetLine2`/`street_line2`, `postalCode`/`postal_code`

Deliberately **not** masked (too broad to be individually identifying, and masking would cripple debugging):

- `city`, `state`, `country`, `company`
- `amount`, `paidOutAmount` (sensitive financial but not identity)
- `platformId` — overloaded: on messages/reservations it's the public platform ID; on payouts it's a bank-transfer reference. Field-name-based redaction can't distinguish the two.
- **`wifiPassword` / `wifi_password`** — semi-public by design (hosts share with every guest). Agent workflows read this to generate check-in messages, so redacting would force operators to bypass sanitization globally. Explicit `SAFE_OVERRIDES` allowlist in `src/utils/sanitize.ts` carves it out of the broad `/password/i` match. A bare `password` field (without the wifi prefix) is still redacted.
- **`smartlockCode` / `smartlock_code`** — same rationale as wifi. The smart-lock access code is shared with the guest for their stay; agents need the real value when composing check-in messages. The field name doesn't match any sanitize pattern naturally, but a test pins this behavior so future pattern additions don't accidentally capture it.

## Gotchas (read this)

Things that routinely trip up agents generating code against this SDK.

1. **`reservations.list` requires `properties`.** Calling with an empty or missing array throws `ConfigurationError` locally before any HTTP request is made. The error message names the field and gives an example. Same goes for `iter()` and the fluent `ReservationFilter.toParams()`.
2. **Status spelling trap** — the legacy `statusHistory[].status` field uses American `canceled` in the raw API response, while `status` and `reservationStatus.current.category` use British `cancelled`. **The SDK normalizes on read**: `normalizeReservation()` rewrites `canceled` → `cancelled` on every response passing through `list()`/`get()`/`iter()`, so `r.statusHistory.some(h => h.status === 'cancelled')` works correctly through the SDK. But if you receive a `Reservation` from a **webhook payload** or a **cached pre-normalization** source, the raw value may still be `'canceled'`. Prefer `reservationStatus.history` in new code — it's consistent all the way down.
3. **`dateQuery` only accepts `'checkin'` or `'checkout'`.** Anything else returns `400`. Default is `'checkin'`. Use `'checkout'` for "still-in-house" or "departing in window" queries. Only one `date_query` per request — see `getInHouse()` for the two-sided case.
4. **`lastMessageAt` format is NOT ISO 8601.** The API expects `'YYYY-MM-DD HH:MM:SS'` (space-separated, no timezone). Passing ISO 8601 returns `400`.
5. **`getInHouse()` timezone caveat.** "Today" is computed from the SDK host's **UTC** clock, not per-property local time. For properties in strongly-offset timezones (e.g. Hawaii at UTC-10), calling during the ~0:00–10:00 UTC window can misclassify a same-day turnover by one day. If you need millisecond-correct boundary behavior, query `list()` directly with a timezone-aware `today`.
6. **`getImages()` returns pre-signed S3 URLs with ~1h expiry.** The SDK does **not** cache this method for that reason. Do not persist the URL — re-fetch when you need the content.
7. **Message attachments are also pre-signed S3 URLs with short expiry.** Same advice: don't cache. Re-fetch the message thread when you need the content.
8. **`transactions` and `payouts` are UNBOUNDED by default.** Calling `.iter()` with no params streams the entire account history (hundreds to thousands of rows). **Always pass `startDate`/`endDate` or `properties`** — especially in agent-driven code paths, where a prompt-injected agent could exfil full financial history in one turn.
9. **`user.get()` and `properties.get()` unwrap a `.data` envelope; other resource `.get()` methods don't.** The Hospitable API is inconsistent: `/v2/user` and `/v2/properties/{id}` wrap their responses in `{data: ...}` while `/v2/reservations/{id}` and `/v2/inquiries/{id}` don't. The SDK handles the unwrap so callers always get a bare resource object regardless of endpoint.
10. **`source: 'public_api'` tags messages sent through this SDK.** Useful for audit: `thread.messages.filter(m => m.source === 'public_api')` returns your own agent's sends.
11. **`inquiry.id === conversation_id`.** Pass it directly to `client.messages.list(inquiry.id)`. Do not look for a separate `conversationId` field on inquiries.
12. **Inquiry → reservation handoff.** While a conversation is still an inquiry (`reservation_id === null`), use `sendForInquiry`. Once a reservation exists, switch to `send`. Using the wrong endpoint returns 410 or 422.
13. **Inquiry sends reject images.** `sendForInquiry`'s options type does not include `images` — pre-booking channels strip attachments. Attach images only on `send`.
14. **`properties` is singular on an `Inquiry`.** The API returns a single `Property` under the plural-sounding `properties` field. The SDK's `normalizeInquiry` (applied automatically) additionally sets `inquiry.property` as an alias; both reference the same object. Prefer `inquiry.property` in new code.
15. **`InquiryFilter.toParams()` throws** if `.properties()` was not called. The underlying endpoint requires it.
16. **`messages` include is `get`-only.** On `client.inquiries.list`, `include=messages` is silently ignored (or rejected). Fetch per-inquiry with `get(uuid, 'messages')`, or call `client.messages.list(inquiry.id)` separately.
17. **`send` / `sendForInquiry` return 202, not the message.** They return `MessageReceipt { sentReferenceId }`. Do not treat the return value as a persisted `Message`.
18. **Do not wrap calls in your own retry loop** for 429/5xx — the SDK already does jittered exponential backoff. Re-wrapping causes double-retries and can trigger 50/5min hard caps.
19. **Dates are ISO strings, not `Date` objects.** `YYYY-MM-DD` for calendar and reservation ranges; ISO 8601 with time/zone for inquiry `lastMessageAt`; `'YYYY-MM-DD HH:MM:SS'` for reservation `lastMessageAt` (yes, different formats on different endpoints — this is the API's doing, not the SDK's).
20. **Only reservation message sends accept `senderId`** (co-host impersonation). Inquiry sends also accept `senderId`, but per the upstream API, it is only honored on Airbnb.
21. **Unknown `include` values are silently ignored by the API.** Don't rely on error feedback for typos — pass only the literals in `ReservationIncludeField` / `ReviewIncludeField` / `InquiryIncludeField`. A misspelled include returns an empty-but-successful response.
22. **URL IDs are auto-encoded.** Every `${id}` interpolation goes through `encodeURIComponent()` before hitting the wire — path-traversal attempts via `'../../admin'` resolve to an encoded no-op, not a different endpoint. You can pass untrusted-ish IDs without extra sanitization.

## Exported types

```ts
// Client
HospitableClient, HospitableClientConfig, ResourceCacheConfig

// Resources (classes — mostly used via client.<resource>)
PropertiesResource, PropertyListParams
ReservationsResource
MessagesResource
CalendarResource
ReviewsResource
InquiriesResource
UserResource
TransactionsResource
PayoutsResource

// Property models
Property, PropertyList, PropertyTag, PropertyImage, PropertySearchParams,
  PropertyAddress, PropertyCapacity, PropertyHouseRules,
  PropertyRoomDetail, PropertyRoomBed, PropertyParentChild,
  PropertyIncludeField, PropertyUser, PropertyListing,
  PropertyListingCoHost, PropertyDetails, PropertyBookings

// Reservation models
Reservation, ReservationList, ReservationListParams,
  ReservationStatus, RESERVATION_STATUSES, isReservationStatus,
  ReservationPlatform, ReservationDateQuery, ReservationIncludeField,
  ReservationStatusObject, ReservationStatusHistoryEntry,
  ReservationLegacyStatusHistoryEntry, ReservationUser,
  Guest, ReservationGuests, normalizeReservation

// Inquiry models
Inquiry, InquiryList, InquiryListParams, InquiryIncludeField,
  InquiryGuest, InquiryGuestCounts, InquiryListing, InquiryUser,
  normalizeInquiry

// Message models
Message, MessageReceipt, MessageThread, MessageTemplate,
  MessageSender, MessageAttachment, MessageReaction,
  MessageSource, MessageSenderType, MessageContentType,
  SendMessageOptions, SendReservationMessageOptions

// Review models
Review, ReviewList, ReviewListParams, ReviewIncludeField,
  ReviewPublic, ReviewPrivate, ReviewDetailedRating,
  ReviewDetailedRatingType, ReviewGuest, ReviewReservation,
  ReviewProperty, ReviewRespondBody

// Calendar models
CalendarData, CalendarDay, CalendarDayPrice, CalendarDayStatus,
  CalendarUpdate

// User / billing models
User

// Financial models
Money, Transaction, TransactionList, TransactionListParams,
  Payout, PayoutList, PayoutListParams

// Pagination
PaginatedResponse<T>, paginate, collectAll, PageFetcher

// Filters
ReservationFilter, PropertyFilter, InquiryFilter

// Errors
HospitableError, ConfigurationError,
  AuthenticationError, ForbiddenError, NotFoundError,
  ValidationError, RateLimitError, ServerError,
  createErrorFromResponse
// Aliases (per AGENTS.md)
HospitableAuthError, HospitableRateLimitError,
  HospitableValidationError, HospitableServerError

// Auth
TokenManager, TokenManagerConfig

// Utils
sanitize, MemoryCache, cacheKey, CacheConfig
```

## License

MIT
