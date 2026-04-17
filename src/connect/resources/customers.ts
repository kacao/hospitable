import type { HttpClient, RequestOptions } from '../../http/client'
import { paginateConnect } from '../paginate'
import type {
  ConnectPaginatedResponse,
  CreateCustomerInput,
  Customer,
} from '../models'

export interface CustomerListParams {
  page?: number
  perPage?: number
  /** Comma-separated subset of Customer fields to return (e.g. `'id,email'`). */
  _select?: string
}

/**
 * Resource for the Connect Customers API. A Customer is one end-user of
 * the partner application; they own Channels (OTA connections).
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class CustomersResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(params: CustomerListParams = {}): Promise<ConnectPaginatedResponse<Customer>> {
    return this.http.get<ConnectPaginatedResponse<Customer>>(
      '/customers',
      params as RequestOptions['params'],
    )
  }

  /**
   * List customers, paginated.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers
   */
  async list(params: CustomerListParams = {}): Promise<ConnectPaginatedResponse<Customer>> {
    return this.fetchList(params)
  }

  /**
   * Stream every customer. Memory-efficient — one page at a time.
   */
  async *iter(params: Omit<CustomerListParams, 'page'> = {}): AsyncGenerator<Customer> {
    yield* paginateConnect<Customer, CustomerListParams>(p => this.fetchList(p), params)
  }

  /**
   * Create a customer. The `id` field is partner-assigned — use any
   * stable string (your app's user ID is the typical choice).
   *
   * @see POST https://connect.hospitable.com/api/v1/customers
   */
  async create(input: CreateCustomerInput): Promise<Customer> {
    const response = await this.http.post<{ data: Customer }>('/customers', input)
    return response.data
  }

  /**
   * Fetch a single customer by id.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers/{customer}
   * @throws {NotFoundError} on 404
   */
  async get(customerId: string): Promise<Customer> {
    const response = await this.http.get<{ data: Customer }>(
      `/customers/${encodeURIComponent(customerId)}`,
    )
    return response.data
  }

  /**
   * Delete a customer and all associated channels / data.
   *
   * @see DELETE https://connect.hospitable.com/api/v1/customers/{customer}
   */
  async delete(customerId: string): Promise<void> {
    await this.http.delete<void>(`/customers/${encodeURIComponent(customerId)}`)
  }
}
