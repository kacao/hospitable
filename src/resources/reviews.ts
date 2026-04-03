import type { HttpClient, RequestOptions } from '../http/client'
import type { Review, ReviewList, ReviewListParams } from '../models/review'
import { paginate } from '../http/paginate'

export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  async list(propertyId: string, params: ReviewListParams = {}): Promise<ReviewList> {
    const normalized: RequestOptions['params'] = {}
    if (params.responded !== undefined) normalized['responded'] = params.responded
    if (params.include !== undefined) normalized['include'] = params.include
    if (params.perPage !== undefined) normalized['perPage'] = params.perPage
    if (params.page !== undefined) normalized['page'] = params.page
    return this.http.get<ReviewList>(`/v2/properties/${propertyId}/reviews`, normalized)
  }

  async respond(id: string, responseText: string): Promise<Review> {
    return this.http.post<Review>(`/v2/reviews/${id}/respond`, { response: responseText })
  }

  async *iter(propertyId: string, params: Omit<ReviewListParams, 'page'> = {}): AsyncGenerator<Review> {
    yield* paginate<Review, ReviewListParams>(p => this.list(propertyId, p), params)
  }
}
