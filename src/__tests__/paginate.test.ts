import { describe, it, expect, vi } from 'vitest'
import { paginate, collectAll } from '../http/paginate'
import type { PaginatedResponse } from '../models/pagination'

interface TestParams {
  cursor?: string
  perPage?: number
  filter?: string
}

function makePage<T>(data: T[], nextCursor: string | null): PaginatedResponse<T> {
  return {
    data,
    meta: { nextCursor, total: 100, perPage: data.length },
  }
}

describe('paginate', () => {
  it('single page (nextCursor = null) — yields all items, stops', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(makePage([1, 2, 3], null))
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
      .mockResolvedValueOnce(makePage(['a', 'b'], 'cursor1'))
      .mockResolvedValueOnce(makePage(['c', 'd'], null))
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
      .mockResolvedValueOnce(makePage([1], 'c1'))
      .mockResolvedValueOnce(makePage([2], 'c2'))
      .mockResolvedValueOnce(makePage([3], null))
    const results: number[] = []
    for await (const item of paginate<number, TestParams>(fetcher, {})) {
      results.push(item)
    }
    expect(results).toEqual([1, 2, 3])
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('empty first page (data = []) — yields nothing, stops', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(makePage([], null))
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
      .mockResolvedValueOnce(makePage([1, 2], 'c1'))
      .mockResolvedValueOnce(makePage([3], null))
    const gen = paginate<number, TestParams>(fetcher, {})
    expect(fetcher).not.toHaveBeenCalled()
    await gen.next()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('passes perPage to fetcher on each call', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage([1], 'c1'))
      .mockResolvedValueOnce(makePage([2], null))
    for await (const _ of paginate<number, TestParams>(fetcher, {}, 25)) {
    }
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ perPage: 25 }))
    expect(fetcher).toHaveBeenNthCalledWith(2, expect.objectContaining({ perPage: 25 }))
  })

  it('second call passes previous nextCursor as cursor', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage([1], 'page2cursor'))
      .mockResolvedValueOnce(makePage([2], null))
    for await (const _ of paginate<number, TestParams>(fetcher, {})) {
    }
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: undefined }))
    expect(fetcher).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'page2cursor' }))
  })

  it('paginate() propagates fetcher rejection to the async iterator consumer', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({
        data: [1, 2],
        meta: { nextCursor: 'cursor-2', total: 4, perPage: 2 }
      })
      .mockRejectedValueOnce(new Error('Network failure'))

    const collected: number[] = []
    await expect(async () => {
      for await (const item of paginate(fetcher, {})) {
        collected.push(item)
      }
    }).rejects.toThrow('Network failure')

    expect(collected).toEqual([1, 2]) // first page was yielded before error
  })
})

describe('collectAll', () => {
  it('returns flattened array across pages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makePage([1, 2], 'c1'))
      .mockResolvedValueOnce(makePage([3, 4], 'c2'))
      .mockResolvedValueOnce(makePage([5], null))
    const result = await collectAll<number, TestParams>(fetcher, {})
    expect(result).toEqual([1, 2, 3, 4, 5])
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('collectAll() rejects when fetcher throws mid-way', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({
        data: [1, 2],
        meta: { nextCursor: 'cursor-2', total: 4, perPage: 2 }
      })
      .mockRejectedValueOnce(new Error('API down'))

    await expect(collectAll(fetcher, {})).rejects.toThrow('API down')
  })
})
