import type { HttpClient, RequestOptions } from '../http/client'
import type { Review, ReviewList, ReviewListParams } from '../models/review'
import { paginate } from '../http/paginate'

/**
 * Resource for listing and responding to guest reviews.
 *
 * Reviews are scoped to a property: all list/iter calls take a `propertyId`
 * as the first argument. Use `params.responded = false` to pull only the
 * reviews still awaiting a host response.
 *
 * @see https://developer.hospitable.com/docs/public-api-docs/v8ue8kuzpfgvj-reviews-resource
 */
export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(propertyId: string, params: ReviewListParams = {}): Promise<ReviewList> {
    const normalized: RequestOptions['params'] = {}
    if (params.responded !== undefined) normalized['responded'] = params.responded
    if (params.include !== undefined) normalized['include'] = params.include
    if (params.perPage !== undefined) normalized['perPage'] = params.perPage
    if (params.page !== undefined) normalized['page'] = params.page
    return this.http.get<ReviewList>(
      `/v2/properties/${encodeURIComponent(propertyId)}/reviews`,
      normalized,
    )
  }

  /**
   * List reviews for a property. Pass `{ responded: false }` to surface
   * only reviews still waiting on a host response.
   *
   * @see GET https://public.api.hospitable.com/v2/properties/{id}/reviews
   */
  async list(propertyId: string, params: ReviewListParams = {}): Promise<ReviewList> {
    return this.fetchList(propertyId, params)
  }

  /**
   * Post a host response to a review.
   *
   * @see POST https://public.api.hospitable.com/v2/reviews/{id}/respond
   */
  async respond(id: string, responseText: string): Promise<Review> {
    return this.http.post<Review>(
      `/v2/reviews/${encodeURIComponent(id)}/respond`,
      { response: responseText },
    )
  }

  /**
   * Stream every review matching `params` for a property, auto-paginating
   * through all pages.
   */
  async *iter(propertyId: string, params: Omit<ReviewListParams, 'page'> = {}): AsyncGenerator<Review> {
    yield* paginate<Review, ReviewListParams>(p => this.fetchList(propertyId, p), params)
  }
}
