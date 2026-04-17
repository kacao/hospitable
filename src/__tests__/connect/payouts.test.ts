import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PayoutsResource } from '../../connect/resources/payouts'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Payout } from '../../connect/models'
import { makeHttpClient } from '../helpers'
import { ForbiddenError, NotFoundError, RateLimitError } from '../../errors'

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

  describe('failure and rate-limit (AGENTS.md triple)', () => {
    it('list() propagates NotFoundError when channel missing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('channel not found'))
      await expect(resource.list('ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('list() propagates ForbiddenError on missing payouts scope (403)', async () => {
      vi.mocked(http.get).mockRejectedValue(new ForbiddenError('missing payouts scope'))
      await expect(resource.list('ch-1')).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('list() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(3))
      await expect(resource.list('ch-1')).rejects.toMatchObject({ retryAfter: 3 })
    })

    it('get() propagates NotFoundError for unknown payout', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('payout not found'))
      await expect(resource.get('ch-1', 'ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('get() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(5))
      await expect(resource.get('ch-1', 'po-1')).rejects.toBeInstanceOf(RateLimitError)
    })
  })
})
