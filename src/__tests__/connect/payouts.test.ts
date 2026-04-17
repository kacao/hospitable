import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PayoutsResource } from '../../connect/resources/payouts'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Payout } from '../../connect/models'
import { makeHttpClient } from '../helpers'

const payout = { id: 'po-1' } as unknown as Payout

function listPage(data: Payout[]): ConnectPaginatedResponse<Payout> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next: null },
    meta: { currentPage: 1, from: 1, to: data.length, path: 'p', perPage: 20 },
  }
}

describe('PayoutsResource', () => {
  let http: HttpClient
  let resource: PayoutsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new PayoutsResource(http)
  })

  it('list() calls GET /channels/{ch}/payouts', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([payout]))
    await resource.list('ch-1')
    expect(http.get).toHaveBeenCalledWith('/channels/ch-1/payouts', {})
  })

  it('get() unwraps single payout', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: payout })
    const result = await resource.get('ch-1', 'po-1')
    expect(http.get).toHaveBeenCalledWith('/channels/ch-1/payouts/po-1')
    expect(result).toEqual(payout)
  })

  it('iter() yields payouts', async () => {
    vi.mocked(http.get).mockResolvedValueOnce(listPage([payout]))
    const out: Payout[] = []
    for await (const p of resource.iter('ch-1')) out.push(p)
    expect(out).toEqual([payout])
  })
})
