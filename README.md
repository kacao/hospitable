# hospitable

[![npm version](https://badge.fury.io/js/hospitable.svg)](https://www.npmjs.com/package/hospitable)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TypeScript SDK for the [Hospitable Public API](https://developer.hospitable.com/docs/public-api-docs/). Manage short-term rental properties, reservations, calendars, guest messaging, and reviews with full type safety.

## Features

- **Full type safety** — 100% typed request/response models, zero `any`
- **Auth** — Personal Access Token and OAuth2 (client credentials + refresh token)
- **Auto-retry** — Jittered exponential backoff for 429 and 5xx errors
- **Auto-refresh** — 401 responses silently trigger token refresh and request retry
- **Pagination** — `iter()` async generators on every resource, no cursor tracking
- **Security** — PII automatically masked in debug logs

## Installation

```bash
npm install hospitable
```

## Quick Start

### Personal Access Token

1. Log in to [my.hospitable.com](https://my.hospitable.com)
2. Go to **Apps → API access → Access tokens → + Add new**
3. Copy your token

```ts
import { HospitableClient } from 'hospitable'

const client = new HospitableClient({ token: 'your_pat_token' })

// Or set HOSPITABLE_PAT env var and call with no args:
// const client = new HospitableClient()

const properties = await client.properties.list()
console.log(`Found ${properties.data.length} properties`)
```

### OAuth2

```ts
// Client credentials (machine-to-machine)
const client = new HospitableClient({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
})

// With refresh token (long-lived sessions)
const client = new HospitableClient({
  token: 'access_token',
  refreshToken: 'refresh_token',
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
})
// Token fetched and refreshed automatically; 401s trigger silent re-auth + retry
```

## Usage

### Properties

```ts
// List all properties
const { data } = await client.properties.list()

// Get a single property
const property = await client.properties.get('property-uuid')

// Iterate all (auto-pagination)
for await (const prop of client.properties.iter()) {
  console.log(prop.name)
}

// Update calendar pricing
await client.properties.updateCalendar('property-uuid', [
  { date: '2026-06-01', price: { amount: 15000 }, available: true, minStay: 2 },
])
```

### Reservations

```ts
// Upcoming confirmed reservations
const upcoming = await client.reservations.getUpcoming(['property-uuid'])

// List with filters
import { ReservationFilter } from 'hospitable'

const filter = new ReservationFilter()
  .checkinAfter('2026-01-01')
  .checkinBefore('2026-12-31')
  .status('confirmed')
  .include('guest', 'properties')
  .perPage(50)

const results = await client.reservations.list(filter.toParams())

// Stream all (memory-efficient)
for await (const reservation of client.reservations.iter({ startDate: '2026-01-01' })) {
  console.log(reservation.id, reservation.status)
}
```

### Messages

```ts
// Send a message
await client.messages.send('reservation-uuid', 'Looking forward to hosting you!')

// List thread
const thread = await client.messages.list('reservation-uuid')

// List and send message templates
const templates = await client.messages.listTemplates()
await client.messages.sendTemplate('reservation-uuid', templates[0].id, { name: 'Alice' })
```

### Calendar

```ts
// Get availability for a date range
const days = await client.calendar.get('property-uuid', '2026-07-01', '2026-07-31')

// Update pricing / availability
await client.calendar.update('property-uuid', [
  { date: '2026-07-15', price: { amount: 20000 }, available: false },
])

// Block dates (owner stays, maintenance, etc.)
await client.calendar.block('property-uuid', '2026-07-01', '2026-07-07', 'Owner stay')

// Unblock
await client.calendar.unblock('property-uuid', '2026-07-01', '2026-07-07')
```

### Reviews

```ts
// List all reviews
const { data } = await client.reviews.list()

// Filter to unresponded only
for await (const review of client.reviews.iter({ responded: false })) {
  await client.reviews.respond(review.id, 'Thank you for your kind words!')
}
```

## Error Handling

```ts
import {
  HospitableClient,
  HospitableError,
  RateLimitError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ServerError,
} from 'hospitable'

try {
  const property = await client.properties.get('uuid')
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}s`)
  } else if (err instanceof AuthenticationError) {
    console.log('Check your token')
  } else if (err instanceof NotFoundError) {
    console.log('Property not found')
  } else if (err instanceof ForbiddenError) {
    console.log('Insufficient permissions')
  } else if (err instanceof ValidationError) {
    console.log('Invalid request:', err.message)
  } else if (err instanceof ServerError) {
    console.log(`Server error after ${err.attempts} attempt(s)`)
  } else if (err instanceof HospitableError) {
    console.log(`API error ${err.statusCode}: ${err.message}`)
  }
}
```

## Rate Limiting & Retries

The SDK automatically retries `429` and `5xx` errors with jittered exponential backoff (up to 4 attempts, max 60s delay). `401` responses trigger a silent token refresh and single retry when OAuth is configured.

```ts
const client = new HospitableClient({
  token: 'your_token',
  retry: {
    maxAttempts: 4,
    baseDelay: 1000,
    maxDelay: 60_000,
    onRateLimit: ({ retryAfter, endpoint, attempt }) => {
      console.warn(`Rate limited on ${endpoint}, attempt ${attempt}, retrying in ${retryAfter}s`)
    },
  },
})
```

## Debug Logging

```ts
const client = new HospitableClient({ token: 'your_token', debug: true })
// Logs every request URL and response body with PII fields masked
```

## License

MIT
