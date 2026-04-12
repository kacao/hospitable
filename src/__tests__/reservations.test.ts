import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReservationsResource } from '../resources/reservations'
import type { HttpClient } from '../http/client'
import type { ReservationList, Reservation, CreateReservationParams, UpdateReservationParams } from '../models/reservation'
import type { EnrichmentField } from '../models/enrichment'
import { ConfigurationError, NotFoundError, RateLimitError, ValidationError } from '../errors'
import { makeHttpClient } from './helpers'

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-1',
    code: 'CODE1',
    platform: 'direct',
    platformId: 'plat-1',
    bookingDate: '2026-01-01',
    arrivalDate: '2026-03-01',
    departureDate: '2026-03-05',
    checkIn: '2026-03-01T15:00:00-08:00',
    checkOut: '2026-03-05T11:00:00-08:00',
    nights: 4,
    stayType: 'guest',
    ownerStay: null,
    reservationStatus: {
      current: { category: 'accepted', subCategory: null },
      history: [
        { category: 'accepted', subCategory: null, changedAt: '2026-01-01T00:00:00+00:00' },
      ],
    },
    status: 'accepted',
    statusHistory: [
      { category: 'Accepted', status: 'accepted', changedAt: '2026-01-01T00:00:00+00:00' },
    ],
    guests: {
      total: 2,
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      petCount: 0,
    },
    notes: null,
    conversationId: 'conv-1',
    conversationLanguage: null,
    lastMessageAt: null,
    issueAlert: null,
    ...overrides,
  }
}

function makeList(
  data: Reservation[],
  currentPage = 1,
  lastPage = 1,
): ReservationList {
  return {
    data,
    meta: { currentPage, lastPage, perPage: 20, total: data.length },
    links: { first: null, last: null, prev: null, next: currentPage < lastPage ? 'next' : null },
  }
}

describe('ReservationsResource', () => {
  let http: HttpClient
  let resource: ReservationsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new ReservationsResource(http)
  })

  describe('list()', () => {
    it('throws ConfigurationError when properties is missing', async () => {
      // @ts-expect-error — testing runtime validation for untyped callers
      await expect(resource.list({})).rejects.toBeInstanceOf(ConfigurationError)
    })

    it('throws ConfigurationError when properties is an empty array', async () => {
      await expect(resource.list({ properties: [] })).rejects.toBeInstanceOf(
        ConfigurationError,
      )
    })

    it('throws with a message that names the offending field', async () => {
      const err = (await resource
        .list({ properties: [] })
        .catch((e) => e)) as Error
      expect(err.message).toContain('properties')
      expect(err.message).toContain('required')
    })

    it('does not make a network call when validation fails', async () => {
      await resource.list({ properties: [] }).catch(() => {})
      expect(http.get).not.toHaveBeenCalled()
    })

    it('calls GET /v2/reservations when properties is provided', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({ properties: ['prop-1'] })

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations',
        expect.objectContaining({ properties: ['prop-1'] }),
      )
    })

    it('passes startDate, endDate, and dateQuery through normalized params', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({
        properties: ['prop-1'],
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        dateQuery: 'checkout',
      })

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations',
        expect.objectContaining({
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          dateQuery: 'checkout',
        }),
      )
    })

    it('passes lastMessageAt through normalized params', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({
        properties: ['prop-1'],
        lastMessageAt: '2026-01-15 14:30:00',
      })

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations',
        expect.objectContaining({ lastMessageAt: '2026-01-15 14:30:00' }),
      )
    })

    it('normalizes single status string to array', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({ properties: ['p'], status: 'accepted' })

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations',
        expect.objectContaining({ status: ['accepted'] }),
      )
    })

    it('preserves status array unchanged', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({ properties: ['p'], status: ['accepted', 'request'] })

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations',
        expect.objectContaining({ status: ['accepted', 'request'] }),
      )
    })

    it('keeps undefined status as undefined when not provided', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({ properties: ['p'], startDate: '2026-01-01' })

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations',
        expect.objectContaining({ status: undefined }),
      )
    })

    it('does not mutate the original params object', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      const params = {
        properties: ['p'],
        status: ['accepted', 'request'] as const,
        startDate: '2026-01-01',
      }
      await resource.list({ ...params, status: [...params.status] })

      expect(params.status).toEqual(['accepted', 'request'])
      expect(params.startDate).toBe('2026-01-01')
    })

    it('smartlockCode field is populated when include=smartlock_code is requested', async () => {
      // Regression guard: smartlock_code is an additive include added
      // after empirical probe of the live API. Agents fetching this
      // field typically use it to generate check-in messages with the
      // door code — same use case as wifiPassword.
      const list = makeList([
        makeReservation({
          id: 'res-with-code',
          smartlockCode: '9588',
        }),
      ])
      vi.mocked(http.get).mockResolvedValue(list)

      const result = await resource.list({
        properties: ['p'],
        include: 'smartlock_code',
      })

      expect(result.data[0]!.smartlockCode).toBe('9588')
      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations',
        expect.objectContaining({ include: 'smartlock_code' }),
      )
    })

    it('smartlockCode is null when the reservation has no code assigned', async () => {
      // Real-world case: the API returns null for cancelled,
      // far-future, or not-accepted reservations.
      const list = makeList([
        makeReservation({ id: 'res-no-code', smartlockCode: null }),
      ])
      vi.mocked(http.get).mockResolvedValue(list)

      const result = await resource.list({
        properties: ['p'],
        include: 'smartlock_code',
      })

      expect(result.data[0]!.smartlockCode).toBe(null)
    })

    it('passes all params through normalization correctly', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({
        page: 2,
        properties: ['prop-1', 'prop-2'],
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        dateQuery: 'checkin',
        lastMessageAt: '2026-01-15 14:30:00',
        status: ['accepted', 'request'],
        include: 'guest,properties,review',
        perPage: 50,
      })

      expect(http.get).toHaveBeenCalledWith('/v2/reservations', {
        page: 2,
        properties: ['prop-1', 'prop-2'],
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        dateQuery: 'checkin',
        lastMessageAt: '2026-01-15 14:30:00',
        status: ['accepted', 'request'],
        include: 'guest,properties,review',
        perPage: 50,
      })
    })
  })

  describe('get()', () => {
    it('calls GET /v2/reservations/{id}', async () => {
      const res = makeReservation({ id: 'res-42' })
      vi.mocked(http.get).mockResolvedValue(res)

      const result = await resource.get('res-42')

      expect(http.get).toHaveBeenCalledWith('/v2/reservations/res-42', undefined)
      expect(result).toBe(res)
    })

    it('passes include param when provided', async () => {
      const res = makeReservation()
      vi.mocked(http.get).mockResolvedValue(res)

      await resource.get('res-1', 'guest,review')

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations/res-1',
        { include: 'guest,review' },
      )
    })
  })

  describe('getUpcoming()', () => {
    it('sets startDate to today, status=accepted, dateQuery=checkin', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.getUpcoming(['prop1'])

      const call = vi.mocked(http.get).mock.calls[0]!
      const params = call[1] as Record<string, unknown>

      expect(params['status']).toEqual(['accepted'])
      expect(params['dateQuery']).toBe('checkin')
      expect(params['include']).toBe('guest,properties')
      expect(params['properties']).toEqual(['prop1'])
    })

    it("dynamically computes today's date", async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      const before = new Date().toISOString().split('T')[0]!
      await resource.getUpcoming(['prop1'])
      const after = new Date().toISOString().split('T')[0]!

      const call = vi.mocked(http.get).mock.calls[0]!
      const params = call[1] as Record<string, unknown>
      const startDate = params['startDate'] as string

      expect(startDate >= before).toBe(true)
      expect(startDate <= after).toBe(true)
    })

    it('allows overriding the include param', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.getUpcoming(['prop1'], { include: 'guest' })

      const call = vi.mocked(http.get).mock.calls[0]!
      const params = call[1] as Record<string, unknown>
      expect(params['include']).toBe('guest')
    })
  })

  describe('getInHouse()', () => {
    // Lock the clock so all arrivalDate boundary tests are deterministic.
    // Without this, the tests hard-coded '2026-01-01' as "in the past"
    // would return wrong assertions if run in any year ≤ 2025, and the
    // "today" computed inside the resource would drift relative to the
    // test's hard-coded fixtures.
    const FIXED_NOW = new Date('2026-04-11T12:00:00Z')
    const FIXED_TODAY = '2026-04-11'

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(FIXED_NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('queries with dateQuery=checkout and startDate=today', async () => {
      vi.mocked(http.get).mockResolvedValue(makeList([]))

      await resource.getInHouse(['prop1'])

      const call = vi.mocked(http.get).mock.calls[0]!
      const params = call[1] as Record<string, unknown>
      expect(params['dateQuery']).toBe('checkout')
      expect(params['status']).toEqual(['accepted'])
      expect(params['properties']).toEqual(['prop1'])
      expect(params['startDate']).toBe(FIXED_TODAY)
    })

    it('filters out reservations whose arrival date is in the future', async () => {
      const currentGuest = makeReservation({ id: 'here', arrivalDate: '2026-04-08' })
      const futureGuest = makeReservation({ id: 'future', arrivalDate: '2026-04-15' })

      vi.mocked(http.get).mockResolvedValue(makeList([currentGuest, futureGuest]))

      const result = await resource.getInHouse(['prop1'])

      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('here')
    })

    it('includes guest arriving exactly today (boundary: arrivalDate === today)', async () => {
      const arriving = makeReservation({
        id: 'arriving-today',
        arrivalDate: FIXED_TODAY,
      })
      vi.mocked(http.get).mockResolvedValue(makeList([arriving]))

      const result = await resource.getInHouse(['prop1'])
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('arriving-today')
    })

    it('includes same-day turnover (arrives and departs today)', async () => {
      // Edge case: guest whose arrival AND departure are both today.
      // Filter must include them — they're "in house" for part of the
      // day. The API query with dateQuery=checkout + startDate=today
      // returns them (their checkout is today), and the client-side
      // arrivalDate <= today filter also passes.
      const sameDay = makeReservation({
        id: 'same-day',
        arrivalDate: FIXED_TODAY,
        departureDate: FIXED_TODAY,
      })
      vi.mocked(http.get).mockResolvedValue(makeList([sameDay]))

      const result = await resource.getInHouse(['prop1'])
      expect(result).toHaveLength(1)
    })

    it('returns an empty array when no reservations match', async () => {
      vi.mocked(http.get).mockResolvedValue(makeList([]))
      const result = await resource.getInHouse(['prop1'])
      expect(result).toEqual([])
    })

    it('handles arrivalDate with full ISO timestamp + timezone offset', async () => {
      // Regression guard for .slice(0, 10) — works for both bare
      // YYYY-MM-DD and full ISO with timezone offset.
      const past = makeReservation({
        id: 'past',
        arrivalDate: '2026-04-08T16:00:00-08:00',
      })
      vi.mocked(http.get).mockResolvedValue(makeList([past]))

      const result = await resource.getInHouse(['prop1'])
      expect(result).toHaveLength(1)
    })

    it('handles arrivalDate with UTC Z suffix', async () => {
      // The probe observed both offset and Z-suffix forms in the wild.
      // Both must pass the slice filter correctly.
      const past = makeReservation({
        id: 'utc',
        arrivalDate: '2026-04-08T16:00:00Z',
      })
      vi.mocked(http.get).mockResolvedValue(makeList([past]))

      const result = await resource.getInHouse(['prop1'])
      expect(result).toHaveLength(1)
    })
  })

  describe('cancel()', () => {
    it('calls POST /v2/reservations/{uuid}/cancel with initiatedBy', async () => {
      const res = makeReservation({ id: 'res-42', status: 'cancelled' })
      vi.mocked(http.post).mockResolvedValue(res)

      const result = await resource.cancel('res-42', 'host')

      expect(http.post).toHaveBeenCalledWith(
        '/v2/reservations/res-42/cancel',
        { initiatedBy: 'host' },
      )
      expect(result.id).toBe('res-42')
    })

    it('normalizes statusHistory on the returned reservation', async () => {
      const res = makeReservation({
        statusHistory: [
          { category: 'Cancelled', status: 'canceled', changedAt: '2026-01-01T00:00:00+00:00' },
        ],
      })
      vi.mocked(http.post).mockResolvedValue(res)

      const result = await resource.cancel('res-1', 'guest')
      expect(result.statusHistory[0]!.status).toBe('cancelled')
    })

    it('propagates ValidationError on 422', async () => {
      vi.mocked(http.post).mockRejectedValue(new ValidationError('Invalid'))
      await expect(resource.cancel('res-1', 'host')).rejects.toBeInstanceOf(ValidationError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.cancel('res-1', 'host').catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })

    it('propagates NotFoundError on 404', async () => {
      vi.mocked(http.post).mockRejectedValue(new NotFoundError('Not found'))
      await expect(resource.cancel('missing', 'host')).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('create()', () => {
    const createParams: CreateReservationParams = {
      propertyId: 'prop-1',
      checkIn: '2026-06-01',
      checkOut: '2026-06-05',
      guests: { adults: 2 },
      guest: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      language: 'en',
      financials: { currency: 'USD', accommodation: 50000 },
    }

    it('calls POST /v2/reservations with params', async () => {
      const res = makeReservation({ id: 'new-res' })
      vi.mocked(http.post).mockResolvedValue(res)

      const result = await resource.create(createParams)

      expect(http.post).toHaveBeenCalledWith('/v2/reservations', createParams)
      expect(result.id).toBe('new-res')
    })

    it('normalizes statusHistory on the returned reservation', async () => {
      const res = makeReservation({
        statusHistory: [
          { category: 'Accepted', status: 'canceled', changedAt: '2026-01-01T00:00:00+00:00' },
        ],
      })
      vi.mocked(http.post).mockResolvedValue(res)

      const result = await resource.create(createParams)
      expect(result.statusHistory[0]!.status).toBe('cancelled')
    })

    it('propagates ValidationError on 422', async () => {
      vi.mocked(http.post).mockRejectedValue(new ValidationError('Invalid'))
      await expect(resource.create(createParams)).rejects.toBeInstanceOf(ValidationError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.create(createParams).catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })
  })

  describe('update()', () => {
    const updateParams: UpdateReservationParams = {
      checkIn: '2026-06-02',
      checkOut: '2026-06-06',
      guests: { adults: 3 },
      guest: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      language: 'en',
      financials: { accommodation: 60000 },
    }

    it('calls PUT /v2/reservations/{uuid} with params', async () => {
      const res = makeReservation({ id: 'res-42' })
      vi.mocked(http.put).mockResolvedValue(res)

      const result = await resource.update('res-42', updateParams)

      expect(http.put).toHaveBeenCalledWith(
        '/v2/reservations/res-42',
        updateParams,
      )
      expect(result.id).toBe('res-42')
    })

    it('normalizes statusHistory on the returned reservation', async () => {
      const res = makeReservation({
        statusHistory: [
          { category: 'Cancelled', status: 'canceled', changedAt: '2026-01-01T00:00:00+00:00' },
        ],
      })
      vi.mocked(http.put).mockResolvedValue(res)

      const result = await resource.update('res-1', updateParams)
      expect(result.statusHistory[0]!.status).toBe('cancelled')
    })

    it('propagates ValidationError on 422', async () => {
      vi.mocked(http.put).mockRejectedValue(new ValidationError('Invalid'))
      await expect(resource.update('res-1', updateParams)).rejects.toBeInstanceOf(ValidationError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.put).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.update('res-1', updateParams).catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })

    it('propagates NotFoundError on 404', async () => {
      vi.mocked(http.put).mockRejectedValue(new NotFoundError('Not found'))
      await expect(resource.update('missing', updateParams)).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('listEnrichment()', () => {
    it('calls GET /v2/reservations/{uuid}/enrichment and unwraps .data', async () => {
      const fields: EnrichmentField[] = [
        { key: 'arrival_time', value: '3pm', description: 'Guest arrival time', example: '3pm' },
      ]
      vi.mocked(http.get).mockResolvedValue({ data: fields })

      const result = await resource.listEnrichment('res-1')

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations/res-1/enrichment',
      )
      expect(result).toEqual(fields)
    })

    it('propagates NotFoundError on 404', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Not found'))
      await expect(resource.listEnrichment('missing')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.listEnrichment('res-1').catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })
  })

  describe('getEnrichment()', () => {
    it('calls GET /v2/reservations/{uuid}/enrichment/{key}', async () => {
      const field: EnrichmentField = {
        key: 'arrival_time', value: '3pm', description: 'Guest arrival time', example: '3pm',
      }
      vi.mocked(http.get).mockResolvedValue(field)

      const result = await resource.getEnrichment('res-1', 'arrival_time')

      expect(http.get).toHaveBeenCalledWith(
        '/v2/reservations/res-1/enrichment/arrival_time',
      )
      expect(result).toEqual(field)
    })

    it('propagates NotFoundError on 404', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Not found'))
      await expect(resource.getEnrichment('missing', 'arrival_time')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.getEnrichment('res-1', 'arrival_time').catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })
  })

  describe('updateEnrichment()', () => {
    it('calls PUT /v2/reservations/{uuid}/enrichment/{key} with value', async () => {
      const field: EnrichmentField = {
        key: 'arrival_time', value: '5pm', description: 'Guest arrival time', example: '3pm',
      }
      vi.mocked(http.put).mockResolvedValue(field)

      const result = await resource.updateEnrichment('res-1', 'arrival_time', '5pm')

      expect(http.put).toHaveBeenCalledWith(
        '/v2/reservations/res-1/enrichment/arrival_time',
        { value: '5pm' },
      )
      expect(result.value).toBe('5pm')
    })

    it('passes null to clear the enrichment value', async () => {
      const field: EnrichmentField = {
        key: 'arrival_time', value: null, description: 'Guest arrival time', example: '3pm',
      }
      vi.mocked(http.put).mockResolvedValue(field)

      const result = await resource.updateEnrichment('res-1', 'arrival_time', null)

      expect(http.put).toHaveBeenCalledWith(
        '/v2/reservations/res-1/enrichment/arrival_time',
        { value: null },
      )
      expect(result.value).toBeNull()
    })

    it('propagates ValidationError on 422', async () => {
      vi.mocked(http.put).mockRejectedValue(new ValidationError('Invalid'))
      await expect(resource.updateEnrichment('res-1', 'arrival_time', '5pm')).rejects.toBeInstanceOf(ValidationError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.put).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.updateEnrichment('res-1', 'arrival_time', '5pm').catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })
  })

  describe('iter()', () => {
    it('throws ConfigurationError when properties is missing', async () => {
      const iter = resource.iter({ properties: [] })
      await expect(iter.next()).rejects.toBeInstanceOf(ConfigurationError)
    })

    it('yields items across 2 pages and stops when lastPage reached', async () => {
      const res1 = makeReservation({ id: 'res-1' })
      const res2 = makeReservation({ id: 'res-2' })
      const res3 = makeReservation({ id: 'res-3' })

      const page1 = makeList([res1, res2], 1, 2)
      const page2 = makeList([res3], 2, 2)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)

      const items: Reservation[] = []
      for await (const item of resource.iter({ properties: ['prop-1'] })) {
        items.push(item)
      }

      expect(items).toHaveLength(3)
      expect(items[0]!.id).toBe('res-1')
      expect(items[2]!.id).toBe('res-3')
      expect(http.get).toHaveBeenCalledTimes(2)
    })

    it('passes status array params through to paginated requests', async () => {
      const page1 = makeList([makeReservation({ id: 'res-1' })], 1, 1)
      vi.mocked(http.get).mockResolvedValue(page1)

      for await (const _ of resource.iter({
        properties: ['prop-1'],
        status: ['accepted', 'request'],
      })) {
        // consume
      }

      const call = vi.mocked(http.get).mock.calls[0]!
      const params = call[1] as Record<string, unknown>
      expect(params['status']).toEqual(['accepted', 'request'])
    })

    it('passes page=2 on second page request', async () => {
      const page1 = makeList([makeReservation({ id: 'res-1' })], 1, 2)
      const page2 = makeList([], 2, 2)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)

      for await (const _ of resource.iter({ properties: ['p'] })) {
        // consume
      }

      const secondCall = vi.mocked(http.get).mock.calls[1]!
      const params = secondCall[1] as Record<string, unknown>
      expect(params['page']).toBe(2)
    })
  })
})
