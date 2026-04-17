import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReservationsResource } from '../../connect/resources/reservations'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Reservation } from '../../connect/models'
import { makeHttpClient } from '../helpers'
import { NotFoundError, RateLimitError } from '../../errors'

const reservation = { id: 'res-1' } as unknown as Reservation

function listPage(
  data: Reservation[],
  nextLink: string | null,
): ConnectPaginatedResponse<Reservation> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next: nextLink },
    meta: { currentPage: 1, from: 1, to: data.length, path: 'p', perPage: 20 },
  }
}

describe('ReservationsResource', () => {
  let http: HttpClient
  let resource: ReservationsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new ReservationsResource(http)
  })

  it('listByListing() calls GET /listings/{l}/reservations', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([reservation], null))
    await resource.listByListing('lst-1', { perPage: 10 })
    expect(http.get).toHaveBeenCalledWith('/listings/lst-1/reservations', { perPage: 10 })
  })

  it('getByListing() unwraps single reservation', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: reservation })
    const result = await resource.getByListing('lst-1', 'res-1')
    expect(http.get).toHaveBeenCalledWith('/listings/lst-1/reservations/res-1')
    expect(result).toEqual(reservation)
  })

  it('listByCustomer() calls GET /customers/{c}/reservations', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([reservation], null))
    await resource.listByCustomer('cust-1')
    expect(http.get).toHaveBeenCalledWith('/customers/cust-1/reservations', {})
  })

  it('getByCustomer() unwraps single reservation', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: reservation })
    const result = await resource.getByCustomer('cust-1', 'res-1')
    expect(http.get).toHaveBeenCalledWith('/customers/cust-1/reservations/res-1')
    expect(result).toEqual(reservation)
  })

  it('iterByListing() auto-paginates', async () => {
    const r2 = { ...reservation, id: 'res-2' } as Reservation
    vi.mocked(http.get)
      .mockResolvedValueOnce(listPage([reservation], 'next'))
      .mockResolvedValueOnce(listPage([r2], null))
    const collected: Reservation[] = []
    for await (const r of resource.iterByListing('lst-1')) collected.push(r)
    expect(collected).toEqual([reservation, r2])
  })

  it('iterByCustomer() auto-paginates', async () => {
    vi.mocked(http.get).mockResolvedValueOnce(listPage([reservation], null))
    const collected: Reservation[] = []
    for await (const r of resource.iterByCustomer('cust-1')) collected.push(r)
    expect(collected).toEqual([reservation])
  })

  it('listByCustomer() forwards Connect filter syntax as-is', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([], null))
    await resource.listByCustomer('cust-1', {
      'arrival_date[before]': '2026-02-01',
      'status[not]': 'deny,cancelled',
    })
    expect(http.get).toHaveBeenCalledWith(
      '/customers/cust-1/reservations',
      expect.objectContaining({
        'arrival_date[before]': '2026-02-01',
        'status[not]': 'deny,cancelled',
      }),
    )
  })

  describe('failure and rate-limit (AGENTS.md triple)', () => {
    it('listByListing() propagates NotFoundError when listing missing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('listing not found'))
      await expect(resource.listByListing('ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('listByListing() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(3))
      await expect(resource.listByListing('lst-1')).rejects.toBeInstanceOf(RateLimitError)
    })

    it('getByListing() propagates NotFoundError for stale reservation id', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('reservation not found'))
      await expect(resource.getByListing('lst-1', 'ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('getByListing() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(7))
      await expect(resource.getByListing('lst-1', 'res-1')).rejects.toBeInstanceOf(RateLimitError)
    })

    it('listByCustomer() propagates NotFoundError when customer missing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('customer not found'))
      await expect(resource.listByCustomer('ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('listByCustomer() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(2))
      await expect(resource.listByCustomer('cust-1')).rejects.toBeInstanceOf(RateLimitError)
    })

    it('getByCustomer() propagates NotFoundError for unknown reservation', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('reservation not found'))
      await expect(resource.getByCustomer('cust-1', 'ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('getByCustomer() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(6))
      await expect(resource.getByCustomer('cust-1', 'res-1')).rejects.toBeInstanceOf(RateLimitError)
    })
  })
})
