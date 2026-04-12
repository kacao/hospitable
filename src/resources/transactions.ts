import type { HttpClient, RequestOptions } from '../http/client'
import type {
  Transaction,
  TransactionList,
  TransactionListParams,
} from '../models/transaction'
import { paginate } from '../http/paginate'

/**
 * Resource for the Hospitable Transactions API.
 *
 * Requires the `financials:read` scope on the access token.
 *
 * ⚠️ **Unbounded-query risk for agents**: unlike `reservations.list()`,
 * this endpoint does not require any mandatory filter. Calling
 * `transactions.iter()` with no params will stream the account's **entire
 * transaction history** (hundreds to thousands of rows on active
 * accounts). Always pass `startDate`/`endDate` or `properties` to scope
 * the query when building agentic workflows — a prompt-injected agent
 * that calls `iter()` without bounds will happily exfiltrate the full
 * financial history in one turn.
 *
 * @see GET https://public.api.hospitable.com/v2/transactions
 */
export class TransactionsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(params: TransactionListParams = {}): Promise<TransactionList> {
    return this.http.get<TransactionList>('/v2/transactions', params as RequestOptions['params'])
  }

  /**
   * Fetch a single transaction by UUID.
   *
   * @see GET https://public.api.hospitable.com/v2/transactions/{uuid}
   * @throws {NotFoundError} on 404
   */
  async get(uuid: string, include?: string): Promise<Transaction> {
    const response = await this.http.get<{ data: Transaction }>(
      `/v2/transactions/${encodeURIComponent(uuid)}`,
      include ? { include } : undefined,
    )
    return response.data
  }

  /**
   * List financial transactions. Use `startDate`/`endDate` to scope to a
   * reporting window.
   *
   * @see GET https://public.api.hospitable.com/v2/transactions
   */
  async list(params: TransactionListParams = {}): Promise<TransactionList> {
    return this.fetchList(params)
  }

  /**
   * Stream every transaction matching `params`, auto-paginating through
   * all pages.
   *
   * ⚠️ **Always pass bounds.** Calling this with no params streams the
   * entire account history — see the resource-level JSDoc. Prefer
   * `{ startDate, endDate }` or `{ properties }` scoping, especially in
   * agent-driven code paths.
   */
  async *iter(params: Omit<TransactionListParams, 'page'> = {}): AsyncGenerator<Transaction> {
    yield* paginate<Transaction, TransactionListParams>(p => this.fetchList(p), params)
  }
}
