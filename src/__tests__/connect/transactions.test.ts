import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionsResource } from '../../connect/resources/transactions'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Transaction } from '../../connect/models'
import { makeHttpClient } from '../helpers'
import {
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
} from '../../errors'

const tx = { id: 'tx-1' } as unknown as Transaction

function listPage(data: Transaction[]): ConnectPaginatedResponse<Transaction> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next: null },
    meta: { currentPage: 1, from: 1, to: data.length, path: 'p', perPage: 20 },
  }
}

describe('TransactionsResource', () => {
  let http: HttpClient
  let resource: TransactionsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new TransactionsResource(http)
  })

  it('list() calls GET /channels/{ch}/transactions', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([tx]))
    await resource.list('ch-1')
    expect(http.get).toHaveBeenCalledWith('/channels/ch-1/transactions', {})
  })

  it('get() unwraps single transaction', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: tx })
    const result = await resource.get('ch-1', 'tx-1')
    expect(http.get).toHaveBeenCalledWith('/channels/ch-1/transactions/tx-1')
    expect(result).toEqual(tx)
  })

  it('iter() yields transactions', async () => {
    vi.mocked(http.get).mockResolvedValueOnce(listPage([tx]))
    const out: Transaction[] = []
    for await (const t of resource.iter('ch-1')) out.push(t)
    expect(out).toEqual([tx])
  })

  describe('failure and rate-limit (AGENTS.md triple)', () => {
    it('list() propagates NotFoundError when channel missing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('channel not found'))
      await expect(resource.list('ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('list() propagates ForbiddenError on missing payments scope (403)', async () => {
      // Transactions require an additional OAuth scope granted after the
      // 2024-01-12 auth-code update. Pre-update customers see 403 here.
      vi.mocked(http.get).mockRejectedValue(new ForbiddenError('missing payments scope'))
      await expect(resource.list('ch-1')).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('list() — ForbiddenError is instance of AuthenticationError (issue #45)', async () => {
      vi.mocked(http.get).mockRejectedValue(new ForbiddenError('missing payments scope'))
      await expect(resource.list('ch-1')).rejects.toBeInstanceOf(AuthenticationError)
    })

    it('list() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(3))
      await expect(resource.list('ch-1')).rejects.toBeInstanceOf(RateLimitError)
    })

    it('get() propagates NotFoundError for stale transaction id', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('transaction not found'))
      await expect(resource.get('ch-1', 'ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('get() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(9))
      await expect(resource.get('ch-1', 'tx-1')).rejects.toMatchObject({ retryAfter: 9 })
    })
  })
})
