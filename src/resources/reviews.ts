import type { HttpClient } from '../http/client'
import type { Review, ReviewList, ReviewListParams } from '../models/review'

export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: ReviewListParams = {}): Promise<ReviewList> {
    const normalized: Record<string, string | number | boolean | string[] | undefined> = {
      propertyId: params.propertyId,
      responded: params.responded,
      cursor: params.cursor,
      perPage: params.perPage,
    }
    return this.http.get<ReviewList>('/v2/reviews', normalized)
  }

  async get(id: string): Promise<Review> {
    return this.http.get<Review>(`/v2/reviews/${id}`)
  }

  async respond(id: string, responseText: string): Promise<Review> {
    return this.http.post<Review>(`/v2/reviews/${id}/response`, { response: responseText })
  }

  async *iter(params: Omit<ReviewListParams, 'cursor'> = {}): AsyncGenerator<Review> {
    let cursor: string | null = null
    do {
      const pageParams: ReviewListParams = { ...params }
      if (cursor !== null) pageParams.cursor = cursor
      const page = await this.list(pageParams)
      for (const item of page.data) yield item
      cursor = page.meta.nextCursor
    } while (cursor !== null)
  }
}
