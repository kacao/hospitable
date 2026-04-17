import type { HttpClient, RequestOptions } from '../../http/client'
import { paginateConnect } from '../paginate'
import type { ConnectPaginatedResponse, Payout } from '../models'

export interface PayoutListParams {
  page?: number
  perPage?: number
  _select?: string
  [key: string]: string | number | boolean | string[] | undefined
}

/**
 * Resource for the Connect Payouts API (beta).
 *
 * Channel-scoped. For customers whose Airbnb channel was authorized
 * before 2024-01-12, re-run the auth-code flow to pick up payout
 * permissions.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class PayoutsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(
    channelId: string,
    params: PayoutListParams,
  ): Promise<ConnectPaginatedResponse<Payout>> {
    return this.http.get<ConnectPaginatedResponse<Payout>>(
      `/channels/${encodeURIComponent(channelId)}/payouts`,
      params as RequestOptions['params'],
    )
  }

  /**
   * List payouts on a channel, paginated.
   *
   * @see GET https://connect.hospitable.com/api/v1/channels/{channel}/payouts
   */
  async list(
    channelId: string,
    params: PayoutListParams = {},
  ): Promise<ConnectPaginatedResponse<Payout>> {
    return this.fetchList(channelId, params)
  }

  /** Stream every payout on a channel. */
  async *iter(
    channelId: string,
    params: Omit<PayoutListParams, 'page'> = {},
  ): AsyncGenerator<Payout> {
    yield* paginateConnect<Payout, PayoutListParams>(
      p => this.fetchList(channelId, p),
      params,
    )
  }

  /**
   * Fetch a single payout scoped to a channel.
   *
   * @see GET https://connect.hospitable.com/api/v1/channels/{channel}/payouts/{payout}
   */
  async get(channelId: string, payoutId: string): Promise<Payout> {
    const response = await this.http.get<{ data: Payout }>(
      `/channels/${encodeURIComponent(channelId)}/payouts/${encodeURIComponent(payoutId)}`,
    )
    return response.data
  }
}
