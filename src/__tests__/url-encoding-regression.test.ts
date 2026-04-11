import { describe, it, expect, afterEach, vi } from 'vitest'
import { HospitableClient } from '../client'

/**
 * Regression guard against path traversal / URL injection in resource
 * methods that interpolate user-supplied IDs into the URL path.
 *
 * Every site that does ``/v2/.../${id}/...`` must call
 * `encodeURIComponent` on the id, otherwise an attacker-controlled input
 * like `'../../admin'` would resolve (via `new URL`'s dot-segment
 * resolution) to a different endpoint while still carrying the caller's
 * PAT — a privilege-rewrite vector for agentic consumers where IDs often
 * flow from LLM output or untrusted upstreams.
 *
 * Each test here captures the `fetch` call and asserts the URL does not
 * contain unencoded path separators from the attacker-supplied id.
 */

afterEach(() => vi.unstubAllGlobals())

function captureFetch(): { calls: string[] } {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      calls.push(url)
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ data: [] }),
      })
    }),
  )
  return { calls }
}

// Attacker-supplied id that tries to escape the intended path segment
// via dot-segment resolution. `new URL('/v2/properties/../../admin', base)`
// resolves to `<base>/admin` — the id-segment is erased entirely.
const EVIL_ID = '../../admin'

// Expected encoded form: `..%2F..%2Fadmin`. URL-decoded server-side, this
// is the literal string `../../admin` which the Hospitable API will
// 404 — the outcome we want.
const EVIL_ENCODED = encodeURIComponent(EVIL_ID) // '..%2F..%2Fadmin'

function expectSafeUrl(url: string, expectedPrefix: string): void {
  // The encoded evil id appears in the URL (server sees literal ../..)
  expect(url).toContain(EVIL_ENCODED)
  // The raw traversal does NOT appear — that's the attack we're blocking
  expect(url).not.toMatch(/\/\.\.\//)
  // And the intended path prefix is still there
  expect(url).toContain(expectedPrefix)
}

describe('URL path traversal prevention — ID encoding regression', () => {
  describe('reservations', () => {
    it('reservations.get() encodes the id', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.reservations.get(EVIL_ID).catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/reservations/')
    })
  })

  describe('properties', () => {
    it('properties.get() encodes the id', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.properties.get(EVIL_ID).catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/properties/')
    })

    it('properties.listTags() encodes the id', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.properties.listTags(EVIL_ID).catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/properties/')
      expect(calls[0]!).toContain('/tags')
    })

    it('properties.getImages() encodes the id', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.properties.getImages(EVIL_ID).catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/properties/')
      expect(calls[0]!).toContain('/images')
    })
  })

  describe('messages', () => {
    it('messages.list() encodes the reservationId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.messages.list(EVIL_ID).catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/reservations/')
      expect(calls[0]!).toContain('/messages')
    })

    it('messages.send() encodes the reservationId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.messages.send(EVIL_ID, 'hello').catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/reservations/')
    })

    it('messages.sendForInquiry() encodes the inquiryUuid', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.messages.sendForInquiry(EVIL_ID, 'hello').catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/inquiries/')
    })

    it('messages.sendTemplate() encodes the reservationId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.messages.sendTemplate(EVIL_ID, 'tpl').catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/reservations/')
      expect(calls[0]!).toContain('/messages/template')
    })
  })

  describe('reviews', () => {
    it('reviews.list() encodes the propertyId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.reviews.list(EVIL_ID).catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/properties/')
      expect(calls[0]!).toContain('/reviews')
    })

    it('reviews.respond() encodes the reviewId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.reviews.respond(EVIL_ID, 'thanks').catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/reviews/')
      expect(calls[0]!).toContain('/respond')
    })
  })

  describe('inquiries', () => {
    it('inquiries.get() encodes the uuid', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.inquiries.get(EVIL_ID).catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/inquiries/')
    })
  })

  describe('calendar', () => {
    it('calendar.get() encodes the propertyId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.calendar
        .get(EVIL_ID, '2026-01-01', '2026-01-31')
        .catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/properties/')
      expect(calls[0]!).toContain('/calendar')
    })

    it('calendar.update() encodes the propertyId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.calendar.update(EVIL_ID, []).catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/properties/')
      expect(calls[0]!).toContain('/calendar')
    })

    it('calendar.block() encodes the propertyId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.calendar
        .block(EVIL_ID, '2026-01-01', '2026-01-31')
        .catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/properties/')
      expect(calls[0]!).toContain('/calendar/block')
    })

    it('calendar.unblock() encodes the propertyId', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      await client.calendar
        .unblock(EVIL_ID, '2026-01-01', '2026-01-31')
        .catch(() => {})
      expectSafeUrl(calls[0]!, '/v2/properties/')
      expect(calls[0]!).toContain('/calendar/unblock')
    })
  })

  describe('special characters (not just traversal)', () => {
    it('properties.get() encodes spaces, slashes, and query-param meta-chars', async () => {
      const { calls } = captureFetch()
      const client = new HospitableClient({ token: 'test' })
      // If an attacker tries `uuid?admin=true`, it would be interpreted
      // as a query string. Encoding prevents that.
      await client.properties.get('abc?admin=true').catch(() => {})
      expect(calls[0]!).toContain('abc%3Fadmin%3Dtrue')
      // The resulting URL should NOT have an extra ?admin= query param
      const url = new URL(calls[0]!)
      expect(url.searchParams.has('admin')).toBe(false)
    })
  })
})
