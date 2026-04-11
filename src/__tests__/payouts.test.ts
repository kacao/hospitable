import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PayoutsResource } from '../resources/payouts'
import type { HttpClient } from '../http/client'
import type { Payout, PayoutList } from '../models/payout'
import { AuthenticationError, ForbiddenError, RateLimitError } from '../errors'
import { makeHttpClient } from './helpers'

function makePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: 'payout-1',
    platform: 'airbnb',
    platformId: 'G-VH5DBQFDLPWL2',
    bankAccount: 'Checking ••4169 (USD)',
    reference: null,
    amount: { amount: 19148, formatted: '$191.48', currency: 'USD' },
    date: '2026-01-15T00:00:00+00:00',
    ...overrides,
  }
}

function makeList(data: Payout[] = []): PayoutList {
  return {
    data,
    meta: { currentPage: 1, lastPage: 1, perPage: 20, total: data.length },
    links: { first: null, last: null, prev: null, next: null },
  }
}

describe('PayoutsResource', () => {
  let http: HttpClient
  let resource: PayoutsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new PayoutsResource(http)
  })

  it('calls GET /v2/payouts with no params by default', async () => {
    vi.mocked(http.get).mockResolvedValue(makeList())
    await resource.list()
    expect(http.get).toHaveBeenCalledWith('/v2/payouts', {})
  })

  it('scopes by startDate and endDate', async () => {
    vi.mocked(http.get).mockResolvedValue(makeList())
    await resource.list({ startDate: '2026-01-01', endDate: '2026-01-31' })
    expect(http.get).toHaveBeenCalledWith(
      '/v2/payouts',
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      }),
    )
  })

  it('iter() yields all payouts across pages and advances to page=2', async () => {
    const p1 = makePayout({ id: 'p-1' })
    const p2 = makePayout({ id: 'p-2' })
    vi.mocked(http.get)
      .mockResolvedValueOnce({
        data: [p1],
        meta: { currentPage: 1, lastPage: 2, perPage: 1, total: 2 },
        links: { first: null, last: null, prev: null, next: 'next' },
      })
      .mockResolvedValueOnce({
        data: [p2],
        meta: { currentPage: 2, lastPage: 2, perPage: 1, total: 2 },
        links: { first: null, last: null, prev: null, next: null },
      })

    const items: Payout[] = []
    for await (const p of resource.iter()) items.push(p)

    expect(items.map((p) => p.id)).toEqual(['p-1', 'p-2'])

    // Regression guard: locks the pagination contract so a paginator
    // regression that always asked for page=1 would fail here.
    const secondCall = vi.mocked(http.get).mock.calls[1]!
    const params = secondCall[1] as Record<string, unknown>
    expect(params['page']).toBe(2)
  })

  describe('error propagation', () => {
    it('throws AuthenticationError on 401', async () => {
      vi.mocked(http.get).mockRejectedValue(new AuthenticationError('Invalid token'))
      await expect(resource.list()).rejects.toBeInstanceOf(AuthenticationError)
    })

    it('throws ForbiddenError on 403 (missing financials:read scope)', async () => {
      vi.mocked(http.get).mockRejectedValue(new ForbiddenError('Missing scope'))
      await expect(resource.list()).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(45, 'req-1'))
      const err = (await resource.list().catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(45)
    })
  })
})
