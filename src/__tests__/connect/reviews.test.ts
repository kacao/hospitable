import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewsResource } from '../../connect/resources/reviews'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Review } from '../../connect/models'
import { makeHttpClient } from '../helpers'
import { NotFoundError, RateLimitError } from '../../errors'

const review = { id: 'rev-1' } as unknown as Review

function listPage(data: Review[]): ConnectPaginatedResponse<Review> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next: null },
    meta: { currentPage: 1, from: 1, to: data.length, path: 'p', perPage: 20 },
  }
}

describe('ReviewsResource', () => {
  let http: HttpClient
  let resource: ReviewsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new ReviewsResource(http)
  })

  it('list() calls GET /channels/{ch}/reviews', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([review]))
    await resource.list('ch-1', { perPage: 25 })
    expect(http.get).toHaveBeenCalledWith('/channels/ch-1/reviews', { perPage: 25 })
  })

  it('iter() yields each review across pages', async () => {
    vi.mocked(http.get).mockResolvedValueOnce(listPage([review]))
    const out: Review[] = []
    for await (const r of resource.iter('ch-1')) out.push(r)
    expect(out).toEqual([review])
  })

  describe('failure and rate-limit (AGENTS.md triple)', () => {
    it('list() propagates NotFoundError when channel missing', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('channel not found'))
      await expect(resource.list('ghost')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('list() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(4))
      await expect(resource.list('ch-1')).rejects.toMatchObject({ retryAfter: 4 })
    })

    it('iter() propagates NotFoundError on the first page', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('channel not found'))
      const run = async () => {
        for await (const _ of resource.iter('ghost')) {
          /* never reached */
        }
      }
      await expect(run()).rejects.toBeInstanceOf(NotFoundError)
    })

    it('iter() propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(6))
      const run = async () => {
        for await (const _ of resource.iter('ch-1')) {
          /* never reached */
        }
      }
      await expect(run()).rejects.toBeInstanceOf(RateLimitError)
    })
  })
})
