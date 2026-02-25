import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReservationsResource } from '../resources/reservations'
import type { HttpClient } from '../http/client'
import type { ReservationList, Reservation } from '../models/reservation'

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-1',
    propertyId: 'prop-1',
    platform: 'direct',
    platformId: 'plat-1',
    status: 'confirmed',
    checkinDate: '2026-03-01',
    checkoutDate: '2026-03-05',
    nights: 4,
    guestCount: 2,
    totalAmount: { amount: 400, currency: 'USD' },
    cleaningFee: { amount: 50, currency: 'USD' },
    platformFee: { amount: 20, currency: 'USD' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeList(
  data: Reservation[],
  nextCursor: string | null = null,
): ReservationList {
  return { data, meta: { nextCursor, total: data.length, perPage: 20 } }
}

function makeHttpClient(): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  } as unknown as HttpClient
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
        cursor: undefined,
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
    it('sets startDate to today, status=confirmed, include=guest,properties', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.getUpcoming(['prop1'])

      const call = vi.mocked(http.get).mock.calls[0]!
      const params = call[1] as Record<string, unknown>

      expect(params['status']).toBe('confirmed')
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
    it('yields items across 2 pages and stops when nextCursor is null', async () => {
      const res1 = makeReservation({ id: 'res-1' })
      const res2 = makeReservation({ id: 'res-2' })
      const res3 = makeReservation({ id: 'res-3' })

      const page1 = makeList([res1, res2], 'cursor-page-2')
      const page2 = makeList([res3], null)

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

    it('passes cursor from first page to second page request', async () => {
      const page1 = makeList([makeReservation({ id: 'res-1' })], 'next-cursor')
      const page2 = makeList([], null)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)

      const items: Reservation[] = []
      for await (const item of resource.iter()) {
        items.push(item)
      }

      const secondCall = vi.mocked(http.get).mock.calls[1]!
      const params = secondCall[1] as Record<string, unknown>
      expect(params['cursor']).toBe('next-cursor')
    })
  })
})
