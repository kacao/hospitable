import type { HttpClient, RequestOptions } from '../http/client'
import type { Review, ReviewList, ReviewListParams } from '../models/review'
import { paginate } from '../http/paginate'

export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: ReviewListParams = {}): Promise<ReviewList> {
    const normalized: RequestOptions['params'] = {}
    if (params.propertyId !== undefined) normalized['propertyId'] = params.propertyId
    if (params.responded !== undefined) normalized['responded'] = params.responded
    if (params.perPage !== undefined) normalized['perPage'] = params.perPage
    if (params.page !== undefined) normalized['page'] = params.page
    return this.http.get<ReviewList>('/v2/reviews', normalized)
  }

  async get(id: string): Promise<Review> {
    return this.http.get<Review>(`/v2/reviews/${id}`)
  }

  async respond(id: string, responseText: string): Promise<Review> {
    return this.http.post<Review>(`/v2/reviews/${id}/response`, { response: responseText })
  }

  async *iter(params: Omit<ReviewListParams, 'page'> = {}): AsyncGenerator<Review> {
    yield* paginate<Review, ReviewListParams>(p => this.list(p), params)
  }
}
