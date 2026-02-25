import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CalendarResource } from '../resources/calendar'
import type { HttpClient } from '../http/client'
import type { CalendarDay, CalendarUpdate } from '../models/calendar'
import type { PaginatedResponse } from '../models/pagination'

function makeCalendarDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2026-03-01',
    available: true,
    price: { amount: 10000, currency: 'USD' },
    minStay: 1,
    maxStay: null,
    notes: null,
    blockedReason: null,
    ...overrides,
  }
}

function makePage(data: CalendarDay[]): PaginatedResponse<CalendarDay> {
  return { data, meta: { nextCursor: null, total: data.length, perPage: 20 } }
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

describe('CalendarResource', () => {
  let http: HttpClient
  let resource: CalendarResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new CalendarResource(http)
  })

  describe('get()', () => {
    it('calls GET with correct path and date params', async () => {
      const page = makePage([makeCalendarDay()])
      vi.mocked(http.get).mockResolvedValue(page)

      const result = await resource.get('prop-1', '2026-03-01', '2026-03-31')

      expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1/calendar', {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      })
      expect(result).toBe(page)
    })
  })

  describe('update()', () => {
    it('calls PUT with { data: updates }', async () => {
      vi.mocked(http.put).mockResolvedValue(undefined)

      const updates: CalendarUpdate[] = [
        { date: '2026-03-01', available: false },
        { date: '2026-03-02', price: { amount: 15000 } },
      ]

      await resource.update('prop-1', updates)

      expect(http.put).toHaveBeenCalledWith('/v2/properties/prop-1/calendar', {
        data: updates,
      })
    })
  })

  describe('block()', () => {
    it('calls POST to /calendar/block with dates', async () => {
      vi.mocked(http.post).mockResolvedValue(undefined)

      await resource.block('prop-1', '2026-03-10', '2026-03-15')

      expect(http.post).toHaveBeenCalledWith('/v2/properties/prop-1/calendar/block', {
        startDate: '2026-03-10',
        endDate: '2026-03-15',
      })
    })

    it('includes reason in body when provided', async () => {
      vi.mocked(http.post).mockResolvedValue(undefined)

      await resource.block('prop-1', '2026-03-10', '2026-03-15', 'maintenance')

      expect(http.post).toHaveBeenCalledWith('/v2/properties/prop-1/calendar/block', {
        startDate: '2026-03-10',
        endDate: '2026-03-15',
        reason: 'maintenance',
      })
    })

    it('omits reason field entirely when not provided', async () => {
      vi.mocked(http.post).mockResolvedValue(undefined)

      await resource.block('prop-1', '2026-03-10', '2026-03-15')

      const call = vi.mocked(http.post).mock.calls[0]!
      const body = call[1] as Record<string, unknown>
      expect('reason' in body).toBe(false)
    })
  })

  describe('unblock()', () => {
    it('calls POST to /calendar/unblock with dates', async () => {
      vi.mocked(http.post).mockResolvedValue(undefined)

      await resource.unblock('prop-1', '2026-03-10', '2026-03-15')

      expect(http.post).toHaveBeenCalledWith('/v2/properties/prop-1/calendar/unblock', {
        startDate: '2026-03-10',
        endDate: '2026-03-15',
      })
    })
  })

  describe('price amounts', () => {
    it('passes price amounts through as-is (cents, integer)', async () => {
      const page = makePage([makeCalendarDay({ price: { amount: 25050, currency: 'USD' } })])
      vi.mocked(http.get).mockResolvedValue(page)

      const result = await resource.get('prop-1', '2026-03-01', '2026-03-01')

      expect(result.data[0]!.price.amount).toBe(25050)
    })
  })
})
