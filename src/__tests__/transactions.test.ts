import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionsResource } from '../resources/transactions'
import type { HttpClient } from '../http/client'
import type { Transaction, TransactionList } from '../models/transaction'
import { AuthenticationError, ForbiddenError, RateLimitError } from '../errors'
import { makeHttpClient } from './helpers'

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    platform: 'airbnb',
    type: 'Payout',
    details: 'Checking ••4169 (USD)',
    reference: null,
    currency: 'USD',
    amount: null,
    paidOutAmount: {
      amount: 19148,
      formatted: '$191.48',
      currency: 'USD',
    },
    date: '2026-01-15T00:00:00+00:00',
    startDate: null,
    ...overrides,
  }
}

function makeList(data: Transaction[] = []): TransactionList {
  return {
    data,
    meta: { currentPage: 1, lastPage: 1, perPage: 20, total: data.length },
    links: { first: null, last: null, prev: null, next: null },
  }
}

describe('TransactionsResource', () => {
  let http: HttpClient
  let resource: TransactionsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new TransactionsResource(http)
  })

  it('calls GET /v2/transactions with no params by default', async () => {
    vi.mocked(http.get).mockResolvedValue(makeList())
    await resource.list()
    expect(http.get).toHaveBeenCalledWith('/v2/transactions', {})
  })

  it('passes startDate, endDate, and properties through', async () => {
    vi.mocked(http.get).mockResolvedValue(makeList())
    await resource.list({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      properties: ['prop-1', 'prop-2'],
    })
    expect(http.get).toHaveBeenCalledWith(
      '/v2/transactions',
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        properties: ['prop-1', 'prop-2'],
      }),
    )
  })

  it('returns the paginated response as-is', async () => {
    const tx = makeTransaction({ id: 'tx-42' })
    vi.mocked(http.get).mockResolvedValue(makeList([tx]))
    const result = await resource.list()
    expect(result.data[0]!.id).toBe('tx-42')
    expect(result.meta.total).toBe(1)
  })

  it('iter() yields transactions across pages and requests page=2 on second call', async () => {
    // Regression guard: without the explicit page=2 assertion a
    // paginator regression that always asked for page=1 would still
    // return the two items (since each mock yields one) and silently
    // pass. This test locks the pagination contract.
    const tx1 = makeTransaction({ id: 'tx-1' })
    const tx2 = makeTransaction({ id: 'tx-2' })
    const page1: TransactionList = {
      data: [tx1],
      meta: { currentPage: 1, lastPage: 2, perPage: 1, total: 2 },
      links: { first: null, last: null, prev: null, next: 'next' },
    }
    const page2: TransactionList = {
      data: [tx2],
      meta: { currentPage: 2, lastPage: 2, perPage: 1, total: 2 },
      links: { first: null, last: null, prev: null, next: null },
    }
    vi.mocked(http.get).mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const items: Transaction[] = []
    for await (const t of resource.iter()) items.push(t)

    expect(items).toHaveLength(2)
    expect(items[0]!.id).toBe('tx-1')
    expect(items[1]!.id).toBe('tx-2')

    // Critical assertion — verifies pagination actually advances
    const secondCall = vi.mocked(http.get).mock.calls[1]!
    const params = secondCall[1] as Record<string, unknown>
    expect(params['page']).toBe(2)
  })

  describe('get()', () => {
    it('calls GET /v2/transactions/{uuid} and unwraps .data', async () => {
      const tx = makeTransaction({ id: 'tx-42' })
      vi.mocked(http.get).mockResolvedValue({ data: tx })

      const result = await resource.get('tx-42')

      expect(http.get).toHaveBeenCalledWith('/v2/transactions/tx-42', undefined)
      expect(result).toEqual(tx)
    })

    it('passes include param when provided', async () => {
      const tx = makeTransaction()
      vi.mocked(http.get).mockResolvedValue({ data: tx })

      await resource.get('tx-1', 'payout,reservation')

      expect(http.get).toHaveBeenCalledWith(
        '/v2/transactions/tx-1',
        { include: 'payout,reservation' },
      )
    })

    it('does not pass include when undefined', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: makeTransaction() })

      await resource.get('tx-1')

      expect(http.get).toHaveBeenCalledWith('/v2/transactions/tx-1', undefined)
    })
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
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(60, 'req-1'))
      const err = (await resource.list().catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(60)
    })
  })
})
