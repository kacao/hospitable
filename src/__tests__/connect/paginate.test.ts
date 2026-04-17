import { describe, it, expect, vi } from 'vitest'
import { paginateConnect } from '../../connect/paginate'
import type { ConnectPaginatedResponse } from '../../connect/models'

function page<T>(data: T[], next: string | null, lastPage?: number): ConnectPaginatedResponse<T> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next },
    meta: {
      currentPage: 1,
      from: data.length > 0 ? 1 : null,
      to: data.length,
      path: 'p',
      perPage: 10,
      ...(lastPage !== undefined ? { lastPage } : {}),
    },
  }
}

describe('paginateConnect', () => {
  it('terminates when links.next is null', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(page([1, 2, 3], null))
    const out: number[] = []
    for await (const n of paginateConnect<number, { page?: number; perPage?: number }>(
      fetcher,
      {},
    )) {
      out.push(n)
    }
    expect(out).toEqual([1, 2, 3])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('continues when next is present and stops when it goes null', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(page([1, 2], 'next'))
      .mockResolvedValueOnce(page([3, 4], 'next'))
      .mockResolvedValueOnce(page([5], null))
    const out: number[] = []
    for await (const n of paginateConnect<number, { page?: number; perPage?: number }>(
      fetcher,
      {},
    )) {
      out.push(n)
    }
    expect(out).toEqual([1, 2, 3, 4, 5])
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('respects lastPage when present, even with lingering next link', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(page([1], 'still-has-next', 1))
    const out: number[] = []
    for await (const n of paginateConnect<number, { page?: number; perPage?: number }>(
      fetcher,
      {},
    )) {
      out.push(n)
    }
    expect(out).toEqual([1])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stops on empty data even with non-null next', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(page<number>([], 'next'))
    const out: number[] = []
    for await (const n of paginateConnect<number, { page?: number; perPage?: number }>(
      fetcher,
      {},
    )) {
      out.push(n)
    }
    expect(out).toEqual([])
  })
})
