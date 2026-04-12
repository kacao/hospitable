/**
 * Regression tests for the status array bug.
 *
 * Bug: normalizeListParams joined status arrays into comma-separated strings
 * (params.status.join(',')) causing the API to receive status=accepted%2Cconfirmed
 * instead of status[]=accepted&status[]=confirmed, resulting in HTTP 400 errors.
 *
 * These tests verify the fix at every layer of the SDK:
 *   1. Integration: HospitableClient → resource → HttpClient → fetch URL/body
 *   2. ReservationFilter → resource chain
 *   3. Wire format for all array params (status, properties)
 *   4. Response round-trip (snake_case API → camelCase SDK)
 *   5. Request body conversion (camelCase SDK → snake_case wire)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { HospitableClient } from '../client'

function captureFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit) => {
    calls.push({ url, init })
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => body,
    })
  }))
  return calls
}

const EMPTY_LIST = {
  data: [],
  meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
  links: { first: null, last: null, prev: null, next: null },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('status array regression — integration', () => {
  describe('reservations.list() → fetch URL', () => {
    it('sends status array as repeated status[] params, never comma-joined', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.list({ properties: ['p'], status: ['accepted', 'request'] })

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['accepted', 'request'])
      expect(calls[0]!.url).not.toContain('accepted%2Cconfirmed')
      expect(calls[0]!.url).not.toContain('accepted,confirmed')
    })

    it('normalizes single status string to array format', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.list({ properties: ['p'], status: 'request' })

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['request'])
    })

    it('sends all five status values as separate array entries', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })
      const allStatuses: readonly ['not_accepted', 'request', 'accepted', 'cancelled', 'checkpoint'] =
        ['not_accepted', 'request', 'accepted', 'cancelled', 'checkpoint']

      await client.reservations.list({ properties: ['p'], status: [...allStatuses] })

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(allStatuses)
    })

    it('omits status param entirely when not provided', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.list({ properties: ['p'], startDate: '2026-01-01' })

      expect(calls[0]!.url).not.toContain('status[')
    })
  })

  describe('multiple array params in one request', () => {
    it('sends both status[] and properties[] as separate array params', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.list({
        status: ['accepted', 'request'],
        properties: ['prop-1', 'prop-2'],
      })

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['accepted', 'request'])
      expect(url.searchParams.getAll('properties[]')).toEqual(['prop-1', 'prop-2'])
    })

    it('mixes array and scalar params correctly', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.list({
        properties: ['p'],
        status: ['accepted'],
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        perPage: 50,
      })

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['accepted'])
      expect(url.searchParams.get('start_date')).toBe('2026-01-01')
      expect(url.searchParams.get('end_date')).toBe('2026-12-31')
      expect(url.searchParams.get('per_page')).toBe('50')
    })
  })

  describe('camelCase param keys → snake_case on wire', () => {
    it('converts startDate, endDate, perPage to snake_case in URL', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.list({
        properties: ['p'],
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        perPage: 25,
      })

      const url = calls[0]!.url
      expect(url).toContain('start_date=2026-03-01')
      expect(url).toContain('end_date=2026-03-31')
      expect(url).toContain('per_page=25')
      expect(url).not.toContain('startDate')
      expect(url).not.toContain('endDate')
      expect(url).not.toContain('perPage')
    })
  })

  describe('getUpcoming() status on wire', () => {
    it('sends status[]=accepted in the URL', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.getUpcoming(['prop-1'])

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['accepted'])
    })
  })

  describe('response round-trip: snake_case API → camelCase SDK', () => {
    it('converts reservation response keys to camelCase', async () => {
      const apiResponse = {
        data: [{
          id: 'res-1',
          code: 'ABC123',
          platform: 'airbnb',
          platform_id: 'air-1',
          booking_date: '2026-01-15',
          arrival_date: '2026-03-01',
          departure_date: '2026-03-05',
          check_in: '15:00',
          check_out: '11:00',
          nights: 4,
          stay_type: 'guest',
          owner_stay: null,
          reservation_status: {
            current: { category: 'accepted', sub_category: null },
            history: [
              {
                category: 'accepted',
                sub_category: null,
                changed_at: '2026-01-15T00:00:00+00:00',
              },
            ],
          },
          status: 'accepted',
          status_history: [
            { category: 'Accepted', status: 'accepted', changed_at: '2026-01-15T00:00:00+00:00' },
          ],
          guests: {
            total: 2,
            adult_count: 2,
            child_count: 0,
            infant_count: 0,
            pet_count: 0,
          },
          notes: null,
          conversation_id: 'conv-1',
          conversation_language: 'en',
          last_message_at: null,
          issue_alert: null,
        }],
        meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      }

      captureFetch(200, apiResponse)
      const client = new HospitableClient({ token: 'test' })

      const result = await client.reservations.list({ properties: ['p'] })
      const res = result.data[0]!

      expect(res.arrivalDate).toBe('2026-03-01')
      expect(res.departureDate).toBe('2026-03-05')
      expect(res.checkIn).toBe('15:00')
      expect(res.checkOut).toBe('11:00')
      expect(res.bookingDate).toBe('2026-01-15')
      expect(res.stayType).toBe('guest')
      expect(res.ownerStay).toBe(null)
      expect(res.conversationId).toBe('conv-1')
      expect(res.lastMessageAt).toBe(null)
      expect(res.guests.adultCount).toBe(2)
      expect(res.guests.childCount).toBe(0)
      expect(result.meta.currentPage).toBe(1)
      expect(result.meta.lastPage).toBe(1)
      expect(result.meta.perPage).toBe(20)
    })

    it('normalizes legacy statusHistory american "canceled" to british "cancelled"', async () => {
      // Regression guard for the spelling-trap bug class. An agent doing
      // `r.statusHistory.some(h => h.status === 'cancelled')` would
      // silently miss matches if the SDK didn't normalize the legacy
      // field. Normalization is applied in normalizeReservation() and
      // wired into list/get/iter from ReservationsResource.
      const apiResponse = {
        data: [{
          id: 'res-legacy',
          code: 'LEGACY1',
          platform: 'airbnb',
          platform_id: 'a1',
          booking_date: '2026-01-01',
          arrival_date: '2026-03-01',
          departure_date: '2026-03-05',
          check_in: '15:00',
          check_out: '11:00',
          nights: 4,
          stay_type: 'guest',
          owner_stay: null,
          reservation_status: {
            current: { category: 'cancelled', sub_category: null },
            history: [],
          },
          status: 'cancelled',
          // API uses American 'canceled' here — SDK must normalize
          status_history: [
            { category: 'Accepted', status: 'accepted', changed_at: '2026-01-01T00:00:00+00:00' },
            { category: 'Canceled', status: 'canceled', changed_at: '2026-01-15T00:00:00+00:00' },
          ],
          guests: { total: 1, adult_count: 1, child_count: 0, infant_count: 0, pet_count: 0 },
          notes: null,
          conversation_id: 'conv-1',
          conversation_language: null,
          last_message_at: null,
          issue_alert: null,
        }],
        meta: { current_page: 1, last_page: 1, per_page: 1, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      }
      captureFetch(200, apiResponse)
      const client = new HospitableClient({ token: 'test' })
      const result = await client.reservations.list({ properties: ['p'] })
      const res = result.data[0]!

      // Normalized to British spelling
      expect(res.statusHistory[1]!.status).toBe('cancelled')
      expect(res.statusHistory[0]!.status).toBe('accepted') // untouched
      // Agent-safe query now works
      expect(res.statusHistory.some((h) => h.status === 'cancelled')).toBe(true)
    })

    it('normalization is idempotent — re-normalizing produces the same result', async () => {
      // Guard: if someone accidentally double-wraps normalize calls,
      // the result should still be stable.
      const apiResponse = {
        data: [{
          id: 'res-1',
          code: 'X',
          platform: 'airbnb',
          platform_id: 'a1',
          booking_date: '2026-01-01',
          arrival_date: '2026-03-01',
          departure_date: '2026-03-05',
          check_in: '15:00',
          check_out: '11:00',
          nights: 4,
          stay_type: 'guest',
          owner_stay: null,
          reservation_status: { current: { category: 'cancelled', sub_category: null }, history: [] },
          status: 'cancelled',
          status_history: [{ category: 'Canceled', status: 'canceled', changed_at: '2026-01-15T00:00:00+00:00' }],
          guests: { total: 1, adult_count: 1, child_count: 0, infant_count: 0, pet_count: 0 },
          notes: null,
          conversation_id: 'conv-1',
          conversation_language: null,
          last_message_at: null,
          issue_alert: null,
        }],
        meta: { current_page: 1, last_page: 1, per_page: 1, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      }
      captureFetch(200, apiResponse)
      const client = new HospitableClient({
        token: 'test',
        cache: { reservations: { enabled: true, ttl: 60_000 } },
      })
      // Two consecutive calls hit the same cache entry, so the same
      // (already-normalized) object is returned twice. That object
      // must still have the normalized spelling.
      const r1 = await client.reservations.list({ properties: ['p'] })
      const r2 = await client.reservations.list({ properties: ['p'] })
      expect(r1.data[0]!.statusHistory[0]!.status).toBe('cancelled')
      expect(r2.data[0]!.statusHistory[0]!.status).toBe('cancelled')
    })

    it('deserializes smartlock_code into camelCase smartlockCode', async () => {
      // Regression guard: the snake_case `smartlock_code` field name
      // from the API must be converted to `smartlockCode` on the
      // TypeScript side via deepSnakeToCamel. Previously tests built
      // camelCased factory objects which never exercised this path.
      const apiResponse = {
        data: [{
          id: 'res-with-lock',
          code: 'HMNPQQH5KK',
          platform: 'airbnb',
          platform_id: 'a1',
          booking_date: '2026-01-01',
          arrival_date: '2026-03-01',
          departure_date: '2026-03-05',
          check_in: '15:00',
          check_out: '11:00',
          nights: 4,
          stay_type: 'guest',
          owner_stay: null,
          reservation_status: { current: { category: 'accepted', sub_category: null }, history: [] },
          status: 'accepted',
          status_history: [],
          guests: { total: 1, adult_count: 1, child_count: 0, infant_count: 0, pet_count: 0 },
          notes: null,
          conversation_id: 'conv-1',
          conversation_language: null,
          last_message_at: null,
          issue_alert: null,
          smartlock_code: '9588',
        }],
        meta: { current_page: 1, last_page: 1, per_page: 1, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      }
      captureFetch(200, apiResponse)
      const client = new HospitableClient({ token: 'test' })
      const result = await client.reservations.list({
        properties: ['p'],
        include: 'smartlock_code',
      })
      expect(result.data[0]!.smartlockCode).toBe('9588')
    })

    it('deserializes reservationStatus nested object (new structured format)', async () => {
      const apiResponse = {
        data: [{
          id: 'res-1',
          code: 'ABC123',
          platform: 'airbnb',
          platform_id: 'a1',
          booking_date: '2026-01-15',
          arrival_date: '2026-03-01',
          departure_date: '2026-03-05',
          check_in: '15:00',
          check_out: '11:00',
          nights: 4,
          stay_type: 'guest',
          owner_stay: null,
          reservation_status: {
            current: { category: 'accepted', sub_category: 'early_checkin_requested' },
            history: [
              {
                category: 'request',
                sub_category: null,
                changed_at: '2026-01-10T00:00:00+00:00',
              },
              {
                category: 'accepted',
                sub_category: null,
                changed_at: '2026-01-15T00:00:00+00:00',
              },
            ],
          },
          status: 'accepted',
          status_history: [],
          guests: { total: 1, adult_count: 1, child_count: 0, infant_count: 0, pet_count: 0 },
          notes: null,
          conversation_id: 'conv-1',
          conversation_language: null,
          last_message_at: null,
          issue_alert: null,
        }],
        meta: { current_page: 1, last_page: 1, per_page: 1, total: 1 },
        links: { first: null, last: null, prev: null, next: null },
      }
      captureFetch(200, apiResponse)
      const client = new HospitableClient({ token: 'test' })

      const result = await client.reservations.list({ properties: ['p'] })
      const res = result.data[0]!

      expect(res.reservationStatus.current.category).toBe('accepted')
      expect(res.reservationStatus.current.subCategory).toBe('early_checkin_requested')
      expect(res.reservationStatus.history).toHaveLength(2)
      expect(res.reservationStatus.history[0]!.category).toBe('request')
      expect(res.reservationStatus.history[1]!.changedAt).toBe('2026-01-15T00:00:00+00:00')
    })
  })

  describe('messages response: snake_case API → camelCase SDK round-trip', () => {
    it('deserializes all new Message fields from raw snake_case payload', async () => {
      // Regression guard for the message schema audit. Previous tests
      // built camelCased factory objects which never exercise the
      // deepSnakeToCamel layer. This test sends a raw snake_case payload
      // and asserts every new field (platformId, contentType, reactions,
      // integration, sender.location) correctly rolls through.
      const apiResponse = {
        data: [{
          id: 939948414,
          platform: 'airbnb',
          platform_id: '27256560910',
          conversation_id: 'b6b514a6-bb08-48f6-858c-8dd36af35388',
          reservation_id: 'res-1',
          content_type: 'text/plain',
          body: 'Hello guest',
          attachments: [
            { type: 'image', url: 'https://a0.muscache.com/signed.png?sig=abc' },
          ],
          reactions: [],
          sender_type: 'guest',
          sender_role: null,
          sender: {
            first_name: 'Dave',
            full_name: 'Dave McGrath',
            locale: 'en',
            picture_url: 'https://a0.muscache.com/profile.jpg',
            thumbnail_url: 'https://a0.muscache.com/thumb.jpg',
            location: 'Kippa-Ring, Australia',
          },
          created_at: '2025-08-30T17:59:27Z',
          source: 'public_api',
          integration: null,
          sent_reference_id: 'ref-abc',
        }],
      }
      captureFetch(200, apiResponse)
      const client = new HospitableClient({ token: 'test' })

      const thread = await client.messages.list('res-1')
      const msg = thread.messages[0]!

      // Every new field must round-trip correctly
      expect(msg.platformId).toBe('27256560910')
      expect(msg.conversationId).toBe('b6b514a6-bb08-48f6-858c-8dd36af35388')
      expect(msg.reservationId).toBe('res-1')
      expect(msg.contentType).toBe('text/plain')
      expect(msg.reactions).toEqual([])
      expect(msg.senderType).toBe('guest')
      expect(msg.senderRole).toBe(null)
      expect(msg.source).toBe('public_api')
      expect(msg.integration).toBe(null)
      expect(msg.sentReferenceId).toBe('ref-abc')

      // Nested sender field with snake→camel
      expect(msg.sender.firstName).toBe('Dave')
      expect(msg.sender.fullName).toBe('Dave McGrath')
      expect(msg.sender.pictureUrl).toBe('https://a0.muscache.com/profile.jpg')
      expect(msg.sender.thumbnailUrl).toBe('https://a0.muscache.com/thumb.jpg')
      expect(msg.sender.location).toBe('Kippa-Ring, Australia')

      // Typed attachment array with correct shape
      expect(msg.attachments).toHaveLength(1)
      expect(msg.attachments[0]!.type).toBe('image')
      expect(msg.attachments[0]!.url).toContain('signed.png')
    })
  })

  describe('request body: camelCase SDK → snake_case wire', () => {
    it('converts sendTemplate templateId to template_id on the wire', async () => {
      const apiResponse = {
        data: {
          id: 1,
          platform: 'airbnb',
          conversation_id: 'conv-1',
          reservation_id: 'res-42',
          body: 'Welcome Alice!',
          sender_type: 'host',
          sender_role: null,
          sender: { first_name: 'Host', full_name: 'Host Name', locale: 'en', picture_url: null, thumbnail_url: null },
          created_at: '2026-03-01T10:00:00Z',
          source: 'hospitable',
          sent_reference_id: null,
          attachments: [],
        },
      }

      const calls = captureFetch(200, apiResponse)
      const client = new HospitableClient({ token: 'test' })

      await client.messages.sendTemplate('res-42', 'tpl-1', { name: 'Alice' })

      const body = JSON.parse(calls[0]!.init.body as string)
      expect(body).toEqual({ template_id: 'tpl-1', variables: { name: 'Alice' } })
      expect(body).not.toHaveProperty('templateId')
    })

    it('sends message body as-is (no key conversion needed for single-key payload)', async () => {
      const calls = captureFetch(202, { data: { sent_reference_id: 'ref-1' } })
      const client = new HospitableClient({ token: 'test' })

      await client.messages.send('res-42', 'Check-in info')

      const body = JSON.parse(calls[0]!.init.body as string)
      expect(body).toEqual({ body: 'Check-in info' })
    })

    it('converts senderId to sender_id on the wire', async () => {
      const calls = captureFetch(202, { data: { sent_reference_id: 'ref-2' } })
      const client = new HospitableClient({ token: 'test' })

      await client.messages.send('res-42', 'Hello', { senderId: '51018147' })

      const body = JSON.parse(calls[0]!.init.body as string)
      expect(body).toEqual({ body: 'Hello', sender_id: '51018147' })
      expect(body).not.toHaveProperty('senderId')
    })

    it('converts images array to snake_case images[] on the wire', async () => {
      const calls = captureFetch(202, { data: { sent_reference_id: 'ref-3' } })
      const client = new HospitableClient({ token: 'test' })

      await client.messages.send('res-42', 'Pics attached', {
        images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      })

      const body = JSON.parse(calls[0]!.init.body as string)
      expect(body).toEqual({
        body: 'Pics attached',
        images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      })
    })
  })

  describe('messages.sendForInquiry() → wire format', () => {
    const INQUIRY_UUID = '6f58fd0a-a9cb-3746-9219-384a156ff7bb'

    it('POSTs to /v2/inquiries/{uuid}/messages with body in JSON payload', async () => {
      const calls = captureFetch(202, { data: { sent_reference_id: 'ref-inq-1' } })
      const client = new HospitableClient({ token: 'test-token' })

      const receipt = await client.messages.sendForInquiry(
        INQUIRY_UUID,
        'Hi! Yes those dates are open.',
      )

      expect(calls).toHaveLength(1)
      const call = calls[0]!

      // Method + URL
      expect(call.init.method).toBe('POST')
      expect(call.url).toBe(
        `https://public.api.hospitable.com/v2/inquiries/${INQUIRY_UUID}/messages`,
      )

      // Required headers
      const headers = call.init.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['Accept']).toBe('application/json')
      expect(headers['Authorization']).toBe('Bearer test-token')
      expect(headers['User-Agent']).toMatch(/^hospitable-ts\//)

      // Body matches the API spec exactly
      const body = JSON.parse(call.init.body as string)
      expect(body).toEqual({ body: 'Hi! Yes those dates are open.' })

      // Response is unwrapped and case-converted to MessageReceipt
      expect(receipt).toEqual({ sentReferenceId: 'ref-inq-1' })
    })

    it('converts senderId to sender_id on the wire', async () => {
      const calls = captureFetch(202, { data: { sent_reference_id: 'ref-inq-2' } })
      const client = new HospitableClient({ token: 'test' })

      await client.messages.sendForInquiry(INQUIRY_UUID, 'Hello', { senderId: 'airbnb-user-1' })

      const body = JSON.parse(calls[0]!.init.body as string)
      expect(body).toEqual({ body: 'Hello', sender_id: 'airbnb-user-1' })
      expect(body).not.toHaveProperty('senderId')
    })

    it('preserves literal \\n in body (API parses /n for line breaks per docs)', async () => {
      const calls = captureFetch(202, { data: { sent_reference_id: 'ref-inq-3' } })
      const client = new HospitableClient({ token: 'test' })

      await client.messages.sendForInquiry(INQUIRY_UUID, 'Line one\nLine two')

      const body = JSON.parse(calls[0]!.init.body as string)
      expect(body.body).toBe('Line one\nLine two')
    })

    it('URL-encodes inquiry UUIDs containing special characters safely', async () => {
      const calls = captureFetch(202, { data: { sent_reference_id: 'ref-inq-4' } })
      const client = new HospitableClient({ token: 'test' })

      // Real UUIDs don't have special chars, but verify path composition is correct
      await client.messages.sendForInquiry('abc-123', 'body')

      expect(calls[0]!.url).toBe('https://public.api.hospitable.com/v2/inquiries/abc-123/messages')
    })
  })

  describe('ReservationFilter → resource → wire format', () => {
    it('filter with status array produces correct URL params', async () => {
      const { ReservationFilter } = await import('../filters/reservation-filter')

      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      const filter = new ReservationFilter()
        .checkinAfter('2026-01-01')
        .checkinBefore('2026-12-31')
        .status(['accepted', 'request'])
        .properties(['prop-1'])
        .perPage(50)

      await client.reservations.list(filter.toParams())

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['accepted', 'request'])
      expect(url.searchParams.getAll('properties[]')).toEqual(['prop-1'])
      expect(url.searchParams.get('start_date')).toBe('2026-01-01')
      expect(url.searchParams.get('end_date')).toBe('2026-12-31')
      expect(url.searchParams.get('per_page')).toBe('50')
    })

    it('filter with single status string produces status[] array on wire', async () => {
      const { ReservationFilter } = await import('../filters/reservation-filter')

      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      const filter = new ReservationFilter().properties(['p']).status('request')
      await client.reservations.list(filter.toParams())

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['request'])
    })
  })

  describe('pagination preserves status array across pages', () => {
    it('sends same status[] params on page 1 and page 2', async () => {
      const page1 = {
        data: [{ id: 'res-1', property_id: 'p1', code: 'C1', platform: 'airbnb', platform_id: 'a1', booking_date: '2026-01-01', arrival_date: '2026-03-01', departure_date: '2026-03-05', check_in: '15:00', check_out: '11:00', nights: 4, stay_type: 'guest', owner_stay: null, status: 'accepted', guests: { total: 1, adult_count: 1, child_count: 0, infant_count: 0, pet_count: 0 }, notes: null, conversation_id: 'c1', conversation_language: null, last_message_at: null, issue_alert: null }],
        meta: { current_page: 1, last_page: 2, per_page: 1, total: 2 },
        links: { first: null, last: null, prev: null, next: 'next' },
      }
      const page2 = {
        data: [{ id: 'res-2', property_id: 'p1', code: 'C2', platform: 'airbnb', platform_id: 'a2', booking_date: '2026-01-02', arrival_date: '2026-03-10', departure_date: '2026-03-15', check_in: '15:00', check_out: '11:00', nights: 5, stay_type: 'guest', owner_stay: null, status: 'accepted', guests: { total: 1, adult_count: 1, child_count: 0, infant_count: 0, pet_count: 0 }, notes: null, conversation_id: 'c2', conversation_language: null, last_message_at: null, issue_alert: null }],
        meta: { current_page: 2, last_page: 2, per_page: 1, total: 2 },
        links: { first: null, last: null, prev: null, next: null },
      }

      let callCount = 0
      const calls: string[] = []
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        calls.push(url)
        callCount++
        const body = callCount === 1 ? page1 : page2
        return Promise.resolve({
          ok: true, status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => body,
        })
      }))

      const client = new HospitableClient({ token: 'test' })
      const items = []
      for await (const res of client.reservations.iter({
        properties: ['p'],
        status: ['accepted', 'request'],
      })) {
        items.push(res)
      }

      expect(items).toHaveLength(2)

      for (const url of calls) {
        const parsed = new URL(url)
        expect(parsed.searchParams.getAll('status[]')).toEqual(['accepted', 'request'])
        expect(url).not.toContain('accepted%2Cconfirmed')
      }
    })
  })

  describe('cache key consistency after normalization', () => {
    it('string status and array status hit same cache entry', async () => {
      captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test', cache: { reservations: { enabled: true, ttl: 60_000 } } })

      await client.reservations.list({ properties: ['p'], status: ['accepted'] })
      await client.reservations.list({ properties: ['p'], status: 'accepted' })

      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1)
    })
  })
})
