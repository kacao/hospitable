import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListingsResource } from '../../connect/resources/listings'
import type { HttpClient } from '../../http/client'
import type {
  CalendarDay,
  ConnectPaginatedResponse,
  Listing,
  ListingImage,
} from '../../connect/models'
import {
  ConfigurationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../../errors'
import { makeHttpClient } from '../helpers'

const listing = { id: 'lst-1' } as unknown as Listing

function listPage(data: Listing[], nextLink: string | null): ConnectPaginatedResponse<Listing> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next: nextLink },
    meta: { currentPage: 1, from: 1, to: data.length, path: 'p', perPage: 20 },
  }
}

describe('ListingsResource', () => {
  let http: HttpClient
  let resource: ListingsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new ListingsResource(http)
  })

  it('list() calls GET /customers/{c}/listings', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([listing], null))
    await resource.list('cust-1', { perPage: 5 })
    expect(http.get).toHaveBeenCalledWith('/customers/cust-1/listings', { perPage: 5 })
  })

  it('get() calls GET /customers/{c}/listings/{l} and unwraps', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: listing })
    const result = await resource.get('cust-1', 'lst-1')
    expect(http.get).toHaveBeenCalledWith('/customers/cust-1/listings/lst-1')
    expect(result).toEqual(listing)
  })

  it('getImages() returns the unwrapped array', async () => {
    const images: ListingImage[] = [
      { url: 'u', thumbnailUrl: 't', caption: 'c', order: 0 },
    ]
    vi.mocked(http.get).mockResolvedValue({ data: images })
    const result = await resource.getImages('cust-1', 'lst-1')
    expect(http.get).toHaveBeenCalledWith('/customers/cust-1/listings/lst-1/images')
    expect(result).toEqual(images)
  })

  it('getCalendar() requires startDate and endDate', async () => {
    await expect(
      // @ts-expect-error — deliberate missing field
      resource.getCalendar('lst-1', { startDate: '2026-01-01' }),
    ).rejects.toBeInstanceOf(ConfigurationError)
  })

  it('getCalendar() forwards date window as query params', async () => {
    const days: CalendarDay[] = []
    vi.mocked(http.get).mockResolvedValue({ data: days })
    await resource.getCalendar('lst-1', { startDate: '2026-01-01', endDate: '2026-01-31' })
    expect(http.get).toHaveBeenCalledWith(
      '/listings/lst-1/calendar',
      { startDate: '2026-01-01', endDate: '2026-01-31' },
    )
  })

  it('updateCalendar() rejects empty day arrays', async () => {
    await expect(resource.updateCalendar('lst-1', [])).rejects.toBeInstanceOf(
      ConfigurationError,
    )
  })

  it('updateCalendar() PUTs { days }', async () => {
    vi.mocked(http.put).mockResolvedValue(undefined)
    await resource.updateCalendar('lst-1', [
      { date: '2026-01-01', price: { amount: 15000, currency: 'USD' } },
    ])
    expect(http.put).toHaveBeenCalledWith('/listings/lst-1/calendar', {
      days: [{ date: '2026-01-01', price: { amount: 15000, currency: 'USD' } }],
    })
  })

  it('iter() stops when next link is null', async () => {
    vi.mocked(http.get).mockResolvedValueOnce(listPage([listing], null))
    const collected: Listing[] = []
    for await (const l of resource.iter('cust-1')) collected.push(l)
    expect(collected).toEqual([listing])
  })

  describe('failure and rate-limit (AGENTS.md triple)', () => {
    it('list() propagates NotFoundError when customer missing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('customer not found'))
      await expect(resource.list('ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('list() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(5))
      await expect(resource.list('cust-1')).rejects.toBeInstanceOf(RateLimitError)
    })

    it('get() propagates NotFoundError for unknown listing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('listing not found'))
      await expect(resource.get('cust-1', 'ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('get() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(2))
      await expect(resource.get('cust-1', 'lst-1')).rejects.toBeInstanceOf(RateLimitError)
    })

    it('getImages() propagates NotFoundError for unknown listing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('listing not found'))
      await expect(resource.getImages('cust-1', 'ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('getImages() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(3))
      await expect(resource.getImages('cust-1', 'lst-1')).rejects.toBeInstanceOf(RateLimitError)
    })

    it('getCalendar() propagates NotFoundError for unknown listing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('listing not found'))
      await expect(
        resource.getCalendar('ghost', { startDate: '2026-01-01', endDate: '2026-01-31' }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('getCalendar() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(4))
      await expect(
        resource.getCalendar('lst-1', { startDate: '2026-01-01', endDate: '2026-01-31' }),
      ).rejects.toBeInstanceOf(RateLimitError)
    })

    it('updateCalendar() propagates ValidationError on bad day payload', async () => {
      vi.mocked(http.put).mockRejectedValue(
        new ValidationError('Invalid payload', { 'days.0.date': ['must be YYYY-MM-DD'] }),
      )
      await expect(
        resource.updateCalendar('lst-1', [{ date: 'bogus' } as unknown as never]),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('updateCalendar() propagates RateLimitError on 429', async () => {
      vi.mocked(http.put).mockRejectedValue(new RateLimitError(6))
      await expect(
        resource.updateCalendar('lst-1', [{ date: '2026-01-01' }]),
      ).rejects.toBeInstanceOf(RateLimitError)
    })
  })
})
