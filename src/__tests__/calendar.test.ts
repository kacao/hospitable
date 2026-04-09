import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CalendarResource } from '../resources/calendar'
import type { HttpClient } from '../http/client'
import type { CalendarDay, CalendarData, CalendarUpdate } from '../models/calendar'
import { NotFoundError, RateLimitError, ValidationError } from '../errors'
import { makeHttpClient } from './helpers'

function makeCalendarDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2026-03-01',
    day: 'SUNDAY',
    minStay: 1,
    closedForCheckin: false,
    closedForCheckout: false,
    status: { reason: 'AVAILABLE', source: null, sourceType: 'RESERVATION', available: true },
    price: { amount: 10000, currency: 'USD', formatted: '$100.00' },
    ...overrides,
  }
}

function makeCalendarData(days: CalendarDay[] = []): CalendarData {
  return {
    listingId: 'prop-1',
    provider: 'airbnb',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    days,
  }
}

describe('CalendarResource', () => {
  let http: HttpClient
  let resource: CalendarResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new CalendarResource(http)
  })

  describe('get()', () => {
    it('calls GET with correct path and date params and returns CalendarData', async () => {
      const calendarData = makeCalendarData([makeCalendarDay()])
      vi.mocked(http.get).mockResolvedValue({ data: calendarData })

      const result = await resource.get('prop-1', '2026-03-01', '2026-03-31')

      expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1/calendar', {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      })
      expect(result).toEqual(calendarData)
    })

    it('unwraps the data wrapper from the response', async () => {
      const calendarData = makeCalendarData([makeCalendarDay()])
      vi.mocked(http.get).mockResolvedValue({ data: calendarData })

      const result = await resource.get('prop-1', '2026-03-01', '2026-03-31')

      expect(result.listingId).toBe('prop-1')
      expect(result.days).toHaveLength(1)
    })

    it('throws NotFoundError when the property does not exist', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Property not found', 'req-1'))

      await expect(
        resource.get('prop-missing', '2026-03-01', '2026-03-31'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(10, 'req-rl'))

      const err = await resource
        .get('prop-1', '2026-03-01', '2026-03-31')
        .catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(10)
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

    it('throws ValidationError on 422 (invalid update payload)', async () => {
      vi.mocked(http.put).mockRejectedValue(
        new ValidationError('Invalid date', { date: ['must be ISO 8601'] }, 'req-1'),
      )

      await expect(
        resource.update('prop-1', [{ date: 'not-a-date', available: false }]),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.put).mockRejectedValue(new RateLimitError(30, 'req-rl'))

      const err = await resource
        .update('prop-1', [{ date: '2026-03-01', available: false }])
        .catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(30)
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

    it('throws NotFoundError when the property does not exist', async () => {
      vi.mocked(http.post).mockRejectedValue(new NotFoundError('Property not found', 'req-1'))

      await expect(
        resource.block('prop-missing', '2026-03-10', '2026-03-15'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(25, 'req-rl'))

      const err = await resource
        .block('prop-1', '2026-03-10', '2026-03-15')
        .catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(25)
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

    it('throws NotFoundError when the property does not exist', async () => {
      vi.mocked(http.post).mockRejectedValue(new NotFoundError('Property not found', 'req-1'))

      await expect(
        resource.unblock('prop-missing', '2026-03-10', '2026-03-15'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(40, 'req-rl'))

      const err = await resource
        .unblock('prop-1', '2026-03-10', '2026-03-15')
        .catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(40)
    })
  })

  describe('price amounts', () => {
    it('passes price amounts through as-is (cents, integer)', async () => {
      const calendarData = makeCalendarData([makeCalendarDay({ price: { amount: 25050, currency: 'USD', formatted: '$250.50' } })])
      vi.mocked(http.get).mockResolvedValue({ data: calendarData })

      const result = await resource.get('prop-1', '2026-03-01', '2026-03-01')

      expect(result.days[0]!.price.amount).toBe(25050)
    })
  })
})
