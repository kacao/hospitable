import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionsResource } from '../../connect/resources/transactions'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Transaction } from '../../connect/models'
import { makeHttpClient } from '../helpers'

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
})
