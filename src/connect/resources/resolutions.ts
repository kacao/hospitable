import type { HttpClient, RequestOptions } from '../../http/client'
import { paginateConnect } from '../paginate'
import type { ConnectPaginatedResponse, Resolution } from '../models'

export interface ResolutionListParams {
  page?: number
  perPage?: number
  _select?: string
  /** Free-form `field[operator]=value` filter bag. See issue #49 for the `string[]` exclusion rationale. */
  [key: string]: string | number | boolean | undefined
}

/**
 * Resource for the Connect Resolutions API (beta).
 *
 * Resolutions are OTA-mediated disputes — security-deposit claims,
 * damage claims, refund requests. Channel-scoped. This surface is
 * **in active development**; response shapes may evolve.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class ResolutionsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(
    channelId: string,
    params: ResolutionListParams,
  ): Promise<ConnectPaginatedResponse<Resolution>> {
    return this.http.get<ConnectPaginatedResponse<Resolution>>(
      `/channels/${encodeURIComponent(channelId)}/resolutions`,
      params as RequestOptions['params'],
    )
  }

  /**
   * List resolutions on a channel, paginated.
   *
   * @see GET https://connect.hospitable.com/api/v1/channels/{channel}/resolutions
   */
  async list(
    channelId: string,
    params: ResolutionListParams = {},
  ): Promise<ConnectPaginatedResponse<Resolution>> {
    return this.fetchList(channelId, params)
  }

  /** Stream every resolution on a channel. */
  async *iter(
    channelId: string,
    params: Omit<ResolutionListParams, 'page'> = {},
  ): AsyncGenerator<Resolution> {
    yield* paginateConnect<Resolution, ResolutionListParams>(
      p => this.fetchList(channelId, p),
      params,
    )
  }
}
