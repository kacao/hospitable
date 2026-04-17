import type { HttpClient, RequestOptions } from '../../http/client'
import { paginateConnect } from '../paginate'
import type { ConnectPaginatedResponse, Reservation } from '../models'

export interface ReservationListParams {
  page?: number
  perPage?: number
  _select?: string
  /**
   * Free-form filter bag — Connect uses `field[operator]=value` syntax
   * (see Filters reference). Keys map 1:1 to query params, so to filter
   * by `arrival_date[after]=2026-01-01` pass
   * `{ 'arrival_date[after]': '2026-01-01' }`. Use `ConnectFilter` for
   * a typed builder.
   *
   * Value type intentionally excludes `string[]`: Connect's filter
   * serialization is comma-joined strings (see `ConnectFilter.where`),
   * so arrays should be pre-joined before hitting this bag. Allowing
   * `string[]` here also accidentally satisfied the numeric `page` /
   * `perPage` slots at compile time, producing silent `NaN` paginator
   * loops — see issue #49.
   */
  [key: string]: string | number | boolean | undefined
}

/**
 * Resource for the Connect Reservations API.
 *
 * Reservations can be queried per-listing (`listings.../reservations`)
 * or per-customer (`customers.../reservations`). The per-customer
 * variant is useful for dashboards aggregating a host's entire book;
 * per-listing is useful for per-property views.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class ReservationsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchByListing(
    listingId: string,
    params: ReservationListParams,
  ): Promise<ConnectPaginatedResponse<Reservation>> {
    return this.http.get<ConnectPaginatedResponse<Reservation>>(
      `/listings/${encodeURIComponent(listingId)}/reservations`,
      params as RequestOptions['params'],
    )
  }

  private fetchByCustomer(
    customerId: string,
    params: ReservationListParams,
  ): Promise<ConnectPaginatedResponse<Reservation>> {
    return this.http.get<ConnectPaginatedResponse<Reservation>>(
      `/customers/${encodeURIComponent(customerId)}/reservations`,
      params as RequestOptions['params'],
    )
  }

  /**
   * List reservations on a single listing.
   *
   * @see GET https://connect.hospitable.com/api/v1/listings/{listing}/reservations
   */
  async listByListing(
    listingId: string,
    params: ReservationListParams = {},
  ): Promise<ConnectPaginatedResponse<Reservation>> {
    return this.fetchByListing(listingId, params)
  }

  /** Stream every reservation on a listing, auto-paginating. */
  async *iterByListing(
    listingId: string,
    params: Omit<ReservationListParams, 'page'> = {},
  ): AsyncGenerator<Reservation> {
    yield* paginateConnect<Reservation, ReservationListParams>(
      p => this.fetchByListing(listingId, p),
      params,
    )
  }

  /**
   * Fetch a single reservation scoped to a listing.
   *
   * @see GET https://connect.hospitable.com/api/v1/listings/{listing}/reservations/{reservation}
   */
  async getByListing(listingId: string, reservationId: string): Promise<Reservation> {
    const response = await this.http.get<{ data: Reservation }>(
      `/listings/${encodeURIComponent(listingId)}/reservations/${encodeURIComponent(reservationId)}`,
    )
    return response.data
  }

  /**
   * List every reservation a customer has across all their listings.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers/{customer}/reservations
   */
  async listByCustomer(
    customerId: string,
    params: ReservationListParams = {},
  ): Promise<ConnectPaginatedResponse<Reservation>> {
    return this.fetchByCustomer(customerId, params)
  }

  /** Stream every reservation for a customer, auto-paginating. */
  async *iterByCustomer(
    customerId: string,
    params: Omit<ReservationListParams, 'page'> = {},
  ): AsyncGenerator<Reservation> {
    yield* paginateConnect<Reservation, ReservationListParams>(
      p => this.fetchByCustomer(customerId, p),
      params,
    )
  }

  /**
   * Fetch a single reservation scoped to a customer.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers/{customer}/reservations/{reservation}
   */
  async getByCustomer(customerId: string, reservationId: string): Promise<Reservation> {
    const response = await this.http.get<{ data: Reservation }>(
      `/customers/${encodeURIComponent(customerId)}/reservations/${encodeURIComponent(reservationId)}`,
    )
    return response.data
  }
}
