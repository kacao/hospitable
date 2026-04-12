import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewsResource } from '../resources/reviews'
import type { HttpClient } from '../http/client'
import type { Review, ReviewList } from '../models/review'
import { NotFoundError, RateLimitError } from '../errors'
import { makeHttpClient } from './helpers'

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'rev-1',
    platform: 'airbnb',
    public: {
      rating: 5,
      ratingPlatformOriginal: '5.00',
      review: 'Great stay!',
      response: null,
    },
    private: {
      feedback: null,
      detailedRatings: [
        { type: 'cleanliness', rating: 5, comment: null },
        { type: 'communication', rating: 5, comment: null },
        { type: 'value', rating: 5, comment: null },
      ],
    },
    reviewedAt: '2026-01-01T00:00:00+00:00',
    respondedAt: null,
    canRespond: true,
    ...overrides,
  }
}

function makeList(data: Review[], currentPage = 1, lastPage = 1): ReviewList {
  return {
    data,
    meta: { currentPage, lastPage, perPage: 20, total: data.length },
    links: { first: null, last: null, prev: null, next: currentPage < lastPage ? 'next' : null },
  }
}

describe('ReviewsResource', () => {
  let http: HttpClient
  let resource: ReviewsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new ReviewsResource(http)
  })

  describe('list()', () => {
    it('calls GET /v2/properties/{id}/reviews with no query params when called with defaults', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      const result = await resource.list('prop-1')

      expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1/reviews', {})
      expect(result).toBe(list)
    })

    it('passes responded and include params through', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list('prop-1', { responded: false, include: 'guest' })

      expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1/reviews', { responded: false, include: 'guest' })
    })

    it('passes include=guest,reservation,property through', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list('prop-1', { include: 'guest,reservation,property' })

      expect(http.get).toHaveBeenCalledWith(
        '/v2/properties/prop-1/reviews',
        { include: 'guest,reservation,property' },
      )
    })

    it('deserializes include=property into review.property', async () => {
      // Regression guard for the include=property support added after
      // empirical probe of the live API.
      const review = makeReview({
        property: {
          id: 'prop-uuid-1',
          name: 'Anaheim-D',
          publicName: 'King Bed - Pool Front - 7 min to Disney',
        },
      })
      vi.mocked(http.get).mockResolvedValue(makeList([review]))

      const result = await resource.list('prop-1', { include: 'property' })

      expect(result.data[0]!.property).toBeDefined()
      expect(result.data[0]!.property!.id).toBe('prop-uuid-1')
      expect(result.data[0]!.property!.name).toBe('Anaheim-D')
      expect(result.data[0]!.property!.publicName).toContain('Disney')
    })

    it('throws NotFoundError when the property does not exist', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Property not found', 'req-1'))

      await expect(resource.list('prop-missing')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(35, 'req-rl'))

      const err = await resource.list('prop-1').catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(35)
    })
  })

  describe('respond()', () => {
    it('POSTs to /v2/reviews/{id}/respond with { response: text }', async () => {
      const updated = makeReview({
        public: {
          rating: 5,
          ratingPlatformOriginal: '5.00',
          review: 'Great stay!',
          response: 'Thank you!',
        },
        respondedAt: '2026-01-02T00:00:00+00:00',
      })
      vi.mocked(http.post).mockResolvedValue(updated)

      const result = await resource.respond('rev-1', 'Thank you!')

      expect(http.post).toHaveBeenCalledWith('/v2/reviews/rev-1/respond', { response: 'Thank you!' })
      expect(result).toBe(updated)
    })

    it('throws NotFoundError when review does not exist', async () => {
      vi.mocked(http.post).mockRejectedValue(new NotFoundError('Review not found', 'req-1'))

      await expect(resource.respond('rev-nonexistent', 'Thanks!')).rejects.toThrow(NotFoundError)
    })

    it('throws RateLimitError when rate limited', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(30, 'req-2'))

      await expect(resource.respond('rev-1', 'Thanks!')).rejects.toThrow(RateLimitError)
    })
  })

  describe('iter()', () => {
    it('yields items across 2 pages and stops when lastPage reached', async () => {
      const rev1 = makeReview({ id: 'rev-1' })
      const rev2 = makeReview({ id: 'rev-2' })
      const rev3 = makeReview({ id: 'rev-3' })

      const page1 = makeList([rev1, rev2], 1, 2)
      const page2 = makeList([rev3], 2, 2)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)

      const items: Review[] = []
      for await (const item of resource.iter('prop-1')) {
        items.push(item)
      }

      expect(items).toHaveLength(3)
      expect(items[0]!.id).toBe('rev-1')
      expect(items[1]!.id).toBe('rev-2')
      expect(items[2]!.id).toBe('rev-3')
      expect(http.get).toHaveBeenCalledTimes(2)
    })

    it('passes page=2 on second page request', async () => {
      const page1 = makeList([makeReview({ id: 'rev-1' })], 1, 2)
      const page2 = makeList([], 2, 2)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)

      for await (const _ of resource.iter('prop-1')) {
        // consume
      }

      const secondCall = vi.mocked(http.get).mock.calls[1]!
      const params = secondCall[1] as Record<string, unknown>
      expect(params['page']).toBe(2)
    })

    it('iter() propagates errors thrown on the second page', async () => {
      const rev1 = makeReview({ id: 'rev-1' })
      const rev2 = makeReview({ id: 'rev-2' })
      const page1 = makeList([rev1, rev2], 1, 2)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockRejectedValueOnce(new Error('Network failure'))

      const items: Review[] = []
      await expect(async () => {
        for await (const item of resource.iter('prop-1')) {
          items.push(item)
        }
      }).rejects.toThrow('Network failure')

      expect(items).toEqual([rev1, rev2])
    })
  })
})
