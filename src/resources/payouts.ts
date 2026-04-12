import type { HttpClient, RequestOptions } from '../http/client'
import type { Payout, PayoutList, PayoutListParams } from '../models/payout'
import { paginate } from '../http/paginate'

/**
 * Resource for the Hospitable Payouts API.
 *
 * Requires the `financials:read` scope on the access token.
 *
 * ⚠️ **Unbounded-query risk for agents**: like {@link TransactionsResource},
 * this endpoint does not require any mandatory filter. Calling
 * `payouts.iter()` with no params will stream the **entire payout
 * history** (often hundreds of rows). Scope with `startDate`/`endDate` or
 * `properties` when building agent workflows, especially if inputs may
 * be attacker-influenced.
 *
 * @see GET https://public.api.hospitable.com/v2/payouts
 */
export class PayoutsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(params: PayoutListParams = {}): Promise<PayoutList> {
    return this.http.get<PayoutList>('/v2/payouts', params as RequestOptions['params'])
  }

  /**
   * Fetch a single payout by UUID.
   *
   * @see GET https://public.api.hospitable.com/v2/payouts/{uuid}
   * @throws {NotFoundError} on 404
   */
  async get(uuid: string, include?: string): Promise<Payout> {
    const response = await this.http.get<{ data: Payout }>(
      `/v2/payouts/${encodeURIComponent(uuid)}`,
      include ? { include } : undefined,
    )
    return response.data
  }

  /**
   * List payouts. Use `startDate`/`endDate` to scope to a reporting window.
   *
   * @see GET https://public.api.hospitable.com/v2/payouts
   */
  async list(params: PayoutListParams = {}): Promise<PayoutList> {
    return this.fetchList(params)
  }

  /**
   * Stream every payout matching `params`, auto-paginating through all pages.
   *
   * ⚠️ **Always pass bounds.** See resource-level JSDoc for the rationale.
   */
  async *iter(params: Omit<PayoutListParams, 'page'> = {}): AsyncGenerator<Payout> {
    yield* paginate<Payout, PayoutListParams>(p => this.fetchList(p), params)
  }
}
