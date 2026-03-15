import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReservationsResource } from '../resources/reservations'
import type { HttpClient } from '../http/client'
import type { ReservationList, Reservation } from '../models/reservation'
import type { OrphanDate } from '../models/reservation'
import { makeHttpClient } from './helpers'

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-1',
    propertyId: 'prop-1',
    code: 'CODE1',
    platform: 'direct',
    platformId: 'plat-1',
    bookingDate: '2026-01-01',
    arrivalDate: '2026-03-01',
    departureDate: '2026-03-05',
    checkIn: '15:00',
    checkOut: '11:00',
    nights: 4,
    stayType: 'guest',
    ownerStay: null,
    status: 'accepted',
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
    it('calls GET /v2/reservations with no params when called with defaults', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      const result = await resource.list()

      expect(http.get).toHaveBeenCalledWith('/v2/reservations', {
        page: undefined,
        endDate: undefined,
        include: undefined,
        perPage: undefined,
        properties: undefined,
        startDate: undefined,
        status: undefined,
      })
      expect(result).toBe(list)
    })

    it('passes properties and startDate params correctly', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({ properties: ['a', 'b'], startDate: '2026-01-01' })

      expect(http.get).toHaveBeenCalledWith('/v2/reservations', expect.objectContaining({
        properties: ['a', 'b'],
        startDate: '2026-01-01',
      }))
    })

    it('joins status array as comma-separated string', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({ status: ['confirmed', 'pending'] })

      expect(http.get).toHaveBeenCalledWith('/v2/reservations', expect.objectContaining({
        status: 'confirmed,pending',
      }))
    })

    it('passes string status through unchanged', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({ status: 'confirmed' })

      expect(http.get).toHaveBeenCalledWith('/v2/reservations', expect.objectContaining({
        status: 'confirmed',
      }))
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

      await resource.get('res-1', 'guest')

      expect(http.get).toHaveBeenCalledWith('/v2/reservations/res-1', { include: 'guest' })
    })
  })

  describe('getUpcoming()', () => {
    it('sets startDate to today, status=accepted, include=guest,properties', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.getUpcoming(['prop1'])

      const call = vi.mocked(http.get).mock.calls[0]!
      const params = call[1] as Record<string, unknown>

      expect(params['status']).toBe('accepted')
      expect(params['include']).toBe('guest,properties')
      expect(params['properties']).toEqual(['prop1'])
    })

    it('dynamically computes today\'s date', async () => {
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

  describe('iter()', () => {
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
      for await (const item of resource.iter()) {
        items.push(item)
      }

      expect(items).toHaveLength(3)
      expect(items[0]!.id).toBe('res-1')
      expect(items[1]!.id).toBe('res-2')
      expect(items[2]!.id).toBe('res-3')
      expect(http.get).toHaveBeenCalledTimes(2)
    })

    it('passes page=2 on second page request', async () => {
      const page1 = makeList([makeReservation({ id: 'res-1' })], 1, 2)
      const page2 = makeList([], 2, 2)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)

      const items: Reservation[] = []
      for await (const item of resource.iter()) {
        items.push(item)
      }

      const secondCall = vi.mocked(http.get).mock.calls[1]!
      const params = secondCall[1] as Record<string, unknown>
      expect(params['page']).toBe(2)
    })
  })

  describe('getOrphanDates()', () => {
    it('returns empty array when no reservations exist', async () => {
      vi.mocked(http.get).mockResolvedValue(makeList([]))
      const result = await resource.getOrphanDates('2026-03-01', '2026-03-31')
      expect(result).toEqual([])
    })

    it('detects a 1-day gap between two reservations on the same property', async () => {
      const before = makeReservation({ id: 'res-a', propertyId: 'prop-1', arrivalDate: '2026-03-01', departureDate: '2026-03-05' })
      const after  = makeReservation({ id: 'res-b', propertyId: 'prop-1', arrivalDate: '2026-03-06', departureDate: '2026-03-10' })
      vi.mocked(http.get).mockResolvedValue(makeList([before, after]))

      const result = await resource.getOrphanDates('2026-03-01', '2026-03-31')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject<OrphanDate>({
        count: 1,
        propertyId: 'prop-1',
        reservationBefore: before,
        reservationAfter: after,
      })
    })

    it('detects a 2-day gap and returns count=2', async () => {
      const before = makeReservation({ id: 'res-a', propertyId: 'prop-1', arrivalDate: '2026-03-01', departureDate: '2026-03-05' })
      const after  = makeReservation({ id: 'res-b', propertyId: 'prop-1', arrivalDate: '2026-03-07', departureDate: '2026-03-10' })
      vi.mocked(http.get).mockResolvedValue(makeList([before, after]))

      const result = await resource.getOrphanDates('2026-03-01', '2026-03-31')

      expect(result[0]!.count).toBe(2)
    })

    it('ignores gaps larger than maxOrphanDays', async () => {
      const before = makeReservation({ id: 'res-a', propertyId: 'prop-1', arrivalDate: '2026-03-01', departureDate: '2026-03-05' })
      const after  = makeReservation({ id: 'res-b', propertyId: 'prop-1', arrivalDate: '2026-03-10', departureDate: '2026-03-15' })
      vi.mocked(http.get).mockResolvedValue(makeList([before, after]))

      const result = await resource.getOrphanDates('2026-03-01', '2026-03-31')

      expect(result).toHaveLength(0)
    })

    it('respects custom maxOrphanDays=3', async () => {
      const before = makeReservation({ id: 'res-a', propertyId: 'prop-1', arrivalDate: '2026-03-01', departureDate: '2026-03-05' })
      const after  = makeReservation({ id: 'res-b', propertyId: 'prop-1', arrivalDate: '2026-03-08', departureDate: '2026-03-12' })
      vi.mocked(http.get).mockResolvedValue(makeList([before, after]))

      const result = await resource.getOrphanDates('2026-03-01', '2026-03-31', 3)

      expect(result).toHaveLength(1)
      expect(result[0]!.count).toBe(3)
    })

    it('reports orphans per property independently', async () => {
      const p1a = makeReservation({ id: 'p1a', propertyId: 'prop-1', arrivalDate: '2026-03-01', departureDate: '2026-03-05' })
      const p1b = makeReservation({ id: 'p1b', propertyId: 'prop-1', arrivalDate: '2026-03-06', departureDate: '2026-03-10' })
      const p2a = makeReservation({ id: 'p2a', propertyId: 'prop-2', arrivalDate: '2026-03-01', departureDate: '2026-03-08' })
      const p2b = makeReservation({ id: 'p2b', propertyId: 'prop-2', arrivalDate: '2026-03-09', departureDate: '2026-03-15' })
      vi.mocked(http.get).mockResolvedValue(makeList([p1a, p1b, p2a, p2b]))

      const result = await resource.getOrphanDates('2026-03-01', '2026-03-31')

      expect(result).toHaveLength(2)
      const propIds = result.map(o => o.propertyId).sort()
      expect(propIds).toEqual(['prop-1', 'prop-2'])
    })

    it('expands fetch start by maxOrphanDays to catch bordering reservations', async () => {
      vi.mocked(http.get).mockResolvedValue(makeList([]))

      await resource.getOrphanDates('2026-03-10', '2026-03-31')

      const call = vi.mocked(http.get).mock.calls[0]!
      const params = call[1] as Record<string, unknown>
      expect(params['startDate']).toBe('2026-03-08')
    })

    it('does not include a gap that falls entirely outside the requested date range', async () => {
      const before = makeReservation({ id: 'res-a', propertyId: 'prop-1', arrivalDate: '2026-02-20', departureDate: '2026-02-25' })
      const after  = makeReservation({ id: 'res-b', propertyId: 'prop-1', arrivalDate: '2026-02-26', departureDate: '2026-03-01' })
      vi.mocked(http.get).mockResolvedValue(makeList([before, after]))

      const result = await resource.getOrphanDates('2026-03-10', '2026-03-31')

      expect(result).toHaveLength(0)
    })
  })
})
