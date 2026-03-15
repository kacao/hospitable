import { describe, it, expect, vi } from 'vitest'
import { paginate, collectAll } from '../http/paginate'
import type { PaginatedResponse } from '../models/pagination'

interface TestParams {
  page?: number
  perPage?: number
  filter?: string
}

function makePage<T>(data: T[], currentPage: number, lastPage: number): PaginatedResponse<T> {
  return {
    data,
    meta: { currentPage, lastPage, perPage: data.length, total: lastPage * data.length },
    links: { first: null, last: null, prev: null, next: currentPage < lastPage ? 'next' : null },
  }
}

describe('paginate', () => {
  it('single page (lastPage = 1) — yields all items, stops', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(makePage([1, 2, 3], 1, 1))
    const results: number[] = []
    for await (const item of paginate<number, TestParams>(fetcher, {})) {
      results.push(item)
    }
    expect(results).toEqual([1, 2, 3])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('two pages — fetcher called twice, all items yielded in order', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage(['a', 'b'], 1, 2))
      .mockResolvedValueOnce(makePage(['c', 'd'], 2, 2))
    const results: string[] = []
    for await (const item of paginate<string, TestParams>(fetcher, {})) {
      results.push(item)
    }
    expect(results).toEqual(['a', 'b', 'c', 'd'])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('three pages — fetcher called three times, items in order', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage([1], 1, 3))
      .mockResolvedValueOnce(makePage([2], 2, 3))
      .mockResolvedValueOnce(makePage([3], 3, 3))
    const results: number[] = []
    for await (const item of paginate<number, TestParams>(fetcher, {})) {
      results.push(item)
    }
    expect(results).toEqual([1, 2, 3])
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('empty first page (data = []) — yields nothing, stops', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(makePage([], 1, 1))
    const results: number[] = []
    for await (const item of paginate<number, TestParams>(fetcher, {})) {
      results.push(item)
    }
    expect(results).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('lazy evaluation: fetcher is only called when iterator is consumed', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage([1, 2], 1, 2))
      .mockResolvedValueOnce(makePage([3], 2, 2))
    const gen = paginate<number, TestParams>(fetcher, {})
    expect(fetcher).not.toHaveBeenCalled()
    await gen.next()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('passes perPage to fetcher when included in params', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage([1], 1, 2))
      .mockResolvedValueOnce(makePage([2], 2, 2))
    for await (const _ of paginate<number, TestParams>(fetcher, { perPage: 25 })) {
    }
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ perPage: 25 }))
    expect(fetcher).toHaveBeenNthCalledWith(2, expect.objectContaining({ perPage: 25 }))
  })

  it('second call passes page=2', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage([1], 1, 2))
      .mockResolvedValueOnce(makePage([2], 2, 2))
    for await (const _ of paginate<number, TestParams>(fetcher, {})) {
    }
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1 }))
    expect(fetcher).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }))
  })

  it('paginate() propagates fetcher rejection to the async iterator consumer', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(makePage([1, 2], 1, 2))
      .mockRejectedValueOnce(new Error('Network failure'))

    const collected: number[] = []
    await expect(async () => {
      for await (const item of paginate(fetcher, {})) {
        collected.push(item)
      }
    }).rejects.toThrow('Network failure')

    expect(collected).toEqual([1, 2])
  })
})

describe('collectAll', () => {
  it('returns flattened array across pages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage([1, 2], 1, 3))
      .mockResolvedValueOnce(makePage([3, 4], 2, 3))
      .mockResolvedValueOnce(makePage([5], 3, 3))
    const result = await collectAll<number, TestParams>(fetcher, {})
    expect(result).toEqual([1, 2, 3, 4, 5])
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('collectAll() rejects when fetcher throws mid-way', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(makePage([1, 2], 1, 2))
      .mockRejectedValueOnce(new Error('API down'))

    await expect(collectAll(fetcher, {})).rejects.toThrow('API down')
  })
})
