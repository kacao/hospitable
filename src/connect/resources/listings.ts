import type { HttpClient, RequestOptions } from '../../http/client'
import { paginateConnect } from '../paginate'
import { ConfigurationError } from '../../errors'
import type {
  CalendarDay,
  ConnectPaginatedResponse,
  Listing,
  ListingImage,
  UpdateCalendarDay,
} from '../models'

export interface ListingListParams {
  page?: number
  perPage?: number
  _select?: string
}

export interface CalendarRangeParams {
  /** ISO `YYYY-MM-DD`, inclusive. */
  startDate: string
  /** ISO `YYYY-MM-DD`, inclusive. Up to 365 days per request. */
  endDate: string
}

/**
 * Resource for the Connect Listings, Pricing & Availability API.
 *
 * Customer-scoped listings: what the Customer owns across every channel.
 * Use {@link ChannelsResource.listListings} when you need channel-scoped
 * listings instead.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class ListingsResource {
  constructor(private readonly http: HttpClient) {}

  private fetchList(
    customerId: string,
    params: ListingListParams,
  ): Promise<ConnectPaginatedResponse<Listing>> {
    return this.http.get<ConnectPaginatedResponse<Listing>>(
      `/customers/${encodeURIComponent(customerId)}/listings`,
      params as RequestOptions['params'],
    )
  }

  /**
   * List all listings a customer owns, across every channel.
   * Unpublished listings are excluded.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers/{customer}/listings
   */
  async list(
    customerId: string,
    params: ListingListParams = {},
  ): Promise<ConnectPaginatedResponse<Listing>> {
    return this.fetchList(customerId, params)
  }

  /**
   * Stream every listing for a customer. Memory-efficient — paginates
   * one page at a time.
   */
  async *iter(
    customerId: string,
    params: Omit<ListingListParams, 'page'> = {},
  ): AsyncGenerator<Listing> {
    yield* paginateConnect<Listing, ListingListParams>(
      p => this.fetchList(customerId, p),
      params,
    )
  }

  /**
   * Fetch a single listing scoped to a customer.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers/{customer}/listings/{listing}
   */
  async get(customerId: string, listingId: string): Promise<Listing> {
    const response = await this.http.get<{ data: Listing }>(
      `/customers/${encodeURIComponent(customerId)}/listings/${encodeURIComponent(listingId)}`,
    )
    return response.data
  }

  /**
   * Fetch photo gallery for a listing, ordered by `order`.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers/{customer}/listings/{listing}/images
   */
  async getImages(customerId: string, listingId: string): Promise<ListingImage[]> {
    const response = await this.http.get<{ data: ListingImage[] }>(
      `/customers/${encodeURIComponent(customerId)}/listings/${encodeURIComponent(listingId)}/images`,
    )
    return response.data
  }

  /**
   * Fetch day-level pricing + availability for a listing.
   *
   * API limits: up to 540 days in the future, max 365 days per
   * request (split into batches for wider windows).
   *
   * @see GET https://connect.hospitable.com/api/v1/listings/{listing}/calendar
   * @throws {ConfigurationError} when `startDate` or `endDate` is missing
   */
  async getCalendar(listingId: string, params: CalendarRangeParams): Promise<CalendarDay[]> {
    if (!params.startDate || !params.endDate) {
      throw new ConfigurationError(
        'listings.getCalendar: `startDate` and `endDate` (YYYY-MM-DD) are required. ' +
          'API rejects calendar queries without an explicit window.',
      )
    }
    const response = await this.http.get<{ data: CalendarDay[] }>(
      `/listings/${encodeURIComponent(listingId)}/calendar`,
      params as unknown as RequestOptions['params'],
    )
    return response.data
  }

  /**
   * Batch-update day-level pricing and/or availability.
   *
   * @see PUT https://connect.hospitable.com/api/v1/listings/{listing}/calendar
   * @throws {ConfigurationError} when `days` is empty
   */
  async updateCalendar(listingId: string, days: UpdateCalendarDay[]): Promise<void> {
    if (days.length === 0) {
      throw new ConfigurationError(
        'listings.updateCalendar: pass at least one day. ' +
          'The API rejects empty calendar update batches.',
      )
    }
    await this.http.put<void>(
      `/listings/${encodeURIComponent(listingId)}/calendar`,
      { days },
    )
  }
}
