import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewsResource } from '../resources/reviews'
import type { HttpClient } from '../http/client'
import type { Review, ReviewList } from '../models/review'

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'rev-1',
    reservationId: 'res-1',
    propertyId: 'prop-1',
    guestName: 'Jane Doe',
    ratings: {
      overall: 5,
      cleanliness: 5,
      communication: 5,
      checkIn: 5,
      accuracy: 5,
      location: 5,
      value: 5,
    },
    body: 'Great stay!',
    response: null,
    submittedAt: '2026-01-01T00:00:00Z',
    respondedAt: null,
    ...overrides,
  }
}

function makeList(data: Review[], nextCursor: string | null = null): ReviewList {
  return { data, meta: { nextCursor, total: data.length, perPage: 20 } }
}

function makeHttpClient(): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  } as unknown as HttpClient
}

describe('ReviewsResource', () => {
  let http: HttpClient
  let resource: ReviewsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new ReviewsResource(http)
  })

  describe('list()', () => {
    it('calls GET /v2/reviews with no params when called with defaults', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      const result = await resource.list()

      expect(http.get).toHaveBeenCalledWith('/v2/reviews', {})
      expect(result).toBe(list)
    })

    it('passes propertyId and responded params through', async () => {
      const list = makeList([])
      vi.mocked(http.get).mockResolvedValue(list)

      await resource.list({ propertyId: 'x', responded: false })

      expect(http.get).toHaveBeenCalledWith('/v2/reviews', { propertyId: 'x', responded: false })
    })
  })

  describe('get()', () => {
    it('calls GET /v2/reviews/{id}', async () => {
      const review = makeReview({ id: 'rev-42' })
      vi.mocked(http.get).mockResolvedValue(review)

      const result = await resource.get('rev-42')

      expect(http.get).toHaveBeenCalledWith('/v2/reviews/rev-42')
      expect(result).toBe(review)
    })
  })

  describe('respond()', () => {
    it('POSTs to /v2/reviews/{id}/response with { response: text }', async () => {
      const updated = makeReview({ response: 'Thank you!', respondedAt: '2026-01-02T00:00:00Z' })
      vi.mocked(http.post).mockResolvedValue(updated)

      const result = await resource.respond('rev-1', 'Thank you!')

      expect(http.post).toHaveBeenCalledWith('/v2/reviews/rev-1/response', { response: 'Thank you!' })
      expect(result).toBe(updated)
    })
  })

  describe('iter()', () => {
    it('yields items across 2 pages and stops when nextCursor is null', async () => {
      const rev1 = makeReview({ id: 'rev-1' })
      const rev2 = makeReview({ id: 'rev-2' })
      const rev3 = makeReview({ id: 'rev-3' })

      const page1 = makeList([rev1, rev2], 'cursor-page-2')
      const page2 = makeList([rev3], null)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)

      const items: Review[] = []
      for await (const item of resource.iter()) {
        items.push(item)
      }

      expect(items).toHaveLength(3)
      expect(items[0]!.id).toBe('rev-1')
      expect(items[1]!.id).toBe('rev-2')
      expect(items[2]!.id).toBe('rev-3')
      expect(http.get).toHaveBeenCalledTimes(2)
    })

    it('passes cursor from first page to second page request', async () => {
      const page1 = makeList([makeReview({ id: 'rev-1' })], 'next-cursor')
      const page2 = makeList([], null)

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)

      for await (const _ of resource.iter()) {
        // consume
      }

      const secondCall = vi.mocked(http.get).mock.calls[1]!
      const params = secondCall[1] as Record<string, unknown>
      expect(params['cursor']).toBe('next-cursor')
    })

    it('iter() propagates errors thrown on the second page', async () => {
      const rev1 = makeReview({ id: 'rev-1' })
      const rev2 = makeReview({ id: 'rev-2' })
      const page1 = makeList([rev1, rev2], 'cursor-page-2')

      vi.mocked(http.get)
        .mockResolvedValueOnce(page1)
        .mockRejectedValueOnce(new Error('Network failure'))

      const items: Review[] = []
      await expect(async () => {
        for await (const item of resource.iter()) {
          items.push(item)
        }
      }).rejects.toThrow('Network failure')

      expect(items).toEqual([rev1, rev2]) // first page items yielded before error
    })
  })
})
