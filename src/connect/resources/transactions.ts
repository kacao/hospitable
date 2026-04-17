import type { HttpClient, RequestOptions } from '../../http/client'
import { paginateConnect } from '../paginate'
import type { ConnectPaginatedResponse, Transaction } from '../models'

export interface TransactionListParams {
  page?: number
  perPage?: number
  _select?: string
  [key: string]: string | number | boolean | string[] | undefined
}

/**
 * Resource for the Connect Transactions API (beta).
 *
 * **Beta**: this surface is not GA. For customers whose Airbnb channel
 * was authorized before 2024-01-12, re-run the auth-code flow to pick
 * up transactions + payouts permissions.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class TransactionsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(
    channelId: string,
    params: TransactionListParams,
  ): Promise<ConnectPaginatedResponse<Transaction>> {
    return this.http.get<ConnectPaginatedResponse<Transaction>>(
      `/channels/${encodeURIComponent(channelId)}/transactions`,
      params as RequestOptions['params'],
    )
  }

  /**
   * List transactions on a channel, paginated.
   *
   * @see GET https://connect.hospitable.com/api/v1/channels/{channel}/transactions
   */
  async list(
    channelId: string,
    params: TransactionListParams = {},
  ): Promise<ConnectPaginatedResponse<Transaction>> {
    return this.fetchList(channelId, params)
  }

  /** Stream every transaction on a channel. */
  async *iter(
    channelId: string,
    params: Omit<TransactionListParams, 'page'> = {},
  ): AsyncGenerator<Transaction> {
    yield* paginateConnect<Transaction, TransactionListParams>(
      p => this.fetchList(channelId, p),
      params,
    )
  }

  /**
   * Fetch a single transaction scoped to a channel.
   *
   * @see GET https://connect.hospitable.com/api/v1/channels/{channel}/transactions/{transaction}
   */
  async get(channelId: string, transactionId: string): Promise<Transaction> {
    const response = await this.http.get<{ data: Transaction }>(
      `/channels/${encodeURIComponent(channelId)}/transactions/${encodeURIComponent(transactionId)}`,
    )
    return response.data
  }
}
