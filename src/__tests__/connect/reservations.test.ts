import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReservationsResource } from '../../connect/resources/reservations'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Reservation } from '../../connect/models'
import { makeHttpClient } from '../helpers'

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
})
