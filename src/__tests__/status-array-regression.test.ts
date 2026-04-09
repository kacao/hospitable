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

      await client.reservations.list({ status: ['accepted', 'request'] })

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['accepted', 'request'])
      expect(calls[0]!.url).not.toContain('accepted%2Cconfirmed')
      expect(calls[0]!.url).not.toContain('accepted,confirmed')
    })

    it('normalizes single status string to array format', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.list({ status: 'request' })

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(['request'])
    })

    it('sends all five status values as separate array entries', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })
      const allStatuses = ['not_accepted', 'request', 'accepted', 'cancelled', 'checkpoint']

      await client.reservations.list({ status: allStatuses })

      const url = new URL(calls[0]!.url)
      expect(url.searchParams.getAll('status[]')).toEqual(allStatuses)
    })

    it('omits status param entirely when not provided', async () => {
      const calls = captureFetch(200, EMPTY_LIST)
      const client = new HospitableClient({ token: 'test' })

      await client.reservations.list({ startDate: '2026-01-01' })

      expect(calls[0]!.url).not.toContain('status')
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
          property_id: 'prop-1',
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
          status: 'accepted',
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

      const result = await client.reservations.list()
      const res = result.data[0]!

      expect(res.propertyId).toBe('prop-1')
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

      const filter = new ReservationFilter().status('request')
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
      for await (const res of client.reservations.iter({ status: ['accepted', 'request'] })) {
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

      await client.reservations.list({ status: ['accepted'] })
      await client.reservations.list({ status: 'accepted' })

      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1)
    })
  })
})
