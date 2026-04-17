import type { HttpClient, RequestOptions } from '../../http/client'
import { paginateConnect } from '../paginate'
import type { ConnectPaginatedResponse, Review } from '../models'

export interface ReviewListParams {
  page?: number
  perPage?: number
  _select?: string
  [key: string]: string | number | boolean | string[] | undefined
}

/**
 * Resource for the Connect Reviews API. Reviews are scoped to a
 * channel — pass the channel id of the OTA account the review came
 * through.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(
    channelId: string,
    params: ReviewListParams,
  ): Promise<ConnectPaginatedResponse<Review>> {
    return this.http.get<ConnectPaginatedResponse<Review>>(
      `/channels/${encodeURIComponent(channelId)}/reviews`,
      params as RequestOptions['params'],
    )
  }

  /**
   * List reviews on a channel, paginated.
   *
   * @see GET https://connect.hospitable.com/api/v1/channels/{channel}/reviews
   */
  async list(
    channelId: string,
    params: ReviewListParams = {},
  ): Promise<ConnectPaginatedResponse<Review>> {
    return this.fetchList(channelId, params)
  }

  /** Stream every review on a channel. */
  async *iter(
    channelId: string,
    params: Omit<ReviewListParams, 'page'> = {},
  ): AsyncGenerator<Review> {
    yield* paginateConnect<Review, ReviewListParams>(p => this.fetchList(channelId, p), params)
  }
}
