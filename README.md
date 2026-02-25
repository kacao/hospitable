# hospitable

[![npm version](https://badge.fury.io/js/hospitable.svg)](https://www.npmjs.com/package/hospitable)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TypeScript SDK for the [Hospitable Public API](https://developer.hospitable.com/docs/public-api-docs/). Manage short-term rental properties, reservations, calendars, and guest messaging with full type safety.

## Features

- **Full type safety** — 100% typed request/response models, zero `any`
- **Auth** — Personal Access Token and OAuth2 (client credentials + refresh)
- **Auto-retry** — Jittered exponential backoff for 429 and 5xx errors
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
const client = new HospitableClient({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
})
// Token fetched and refreshed automatically
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
// Upcoming confirmed reservations (great for AI agents)
const upcoming = await client.reservations.getUpcoming(['property-uuid'])

// List with filters
import { ReservationFilter } from 'hospitable'

const filter = new ReservationFilter()
  .checkinAfter('2026-01-01')
  .status('confirmed')
  .include('guest', 'properties')

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
```

### Calendar

```ts
// Block dates
await client.calendar.block('property-uuid', '2026-07-01', '2026-07-07', 'Owner stay')

// Unblock
await client.calendar.unblock('property-uuid', '2026-07-01', '2026-07-07')
```

### Reviews

```ts
// List unresponded reviews
for await (const review of client.reviews.iter({ responded: false })) {
  await client.reviews.respond(review.id, 'Thank you for your kind words!')
}
```

## Error Handling

```ts
import { HospitableClient, RateLimitError, AuthenticationError, NotFoundError } from 'hospitable'

try {
  const property = await client.properties.get('uuid')
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}s`)
  } else if (err instanceof AuthenticationError) {
    console.log('Check your token')
  } else if (err instanceof NotFoundError) {
    console.log('Property not found')
  }
}
```

## Rate Limiting & Retries

The SDK automatically retries `429` and `5xx` errors with jittered exponential backoff (up to 4 attempts, max 60s delay). To observe throttling:

```ts
const client = new HospitableClient({
  token: 'your_token',
  retry: {
    onRateLimit: ({ retryAfter, endpoint, attempt }) => {
      console.warn(`Rate limited on ${endpoint}, attempt ${attempt}, retrying in ${retryAfter}s`)
    },
  },
})
```

## License

MIT
