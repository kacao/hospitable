import type { HttpClient, RequestOptions } from '../http/client'
import type {
  Reservation,
  ReservationList,
  ReservationListParams,
} from '../models/reservation'
import { paginate } from '../http/paginate'
import { MemoryCache, cacheKey, type CacheConfig } from '../utils/cache'

const DEFAULT_TTL = 60_000

function normalizeListParams(params: ReservationListParams) {
  return {
    page: params.page,
    properties: params.properties,
    startDate: params.startDate,
    endDate: params.endDate,
    status: Array.isArray(params.status) ? params.status : params.status ? [params.status] : undefined,
    include: params.include,
    perPage: params.perPage,
  }
}

/**
 * Resource for the Hospitable Reservations API.
 *
 * Default cache TTL is 60 seconds when caching is enabled — reservations
 * move too quickly for long-lived caching.
 *
 * @see https://developer.hospitable.com/docs/public-api-docs/a6ba5e23bc9cb-reservations-resource
 */
export class ReservationsResource {
  private cache: MemoryCache<unknown> | null

  constructor(
    private readonly http: HttpClient,
    cacheConfig?: CacheConfig,
  ) {
    const enabled = cacheConfig?.enabled ?? false
    this.cache = enabled
      ? new MemoryCache({ ttl: cacheConfig?.ttl ?? DEFAULT_TTL, ...(cacheConfig?.maxSize !== undefined ? { maxSize: cacheConfig.maxSize } : {}) })
      : null
  }

  private fetchList(params: ReservationListParams = {}): Promise<ReservationList> {
    const normalized = normalizeListParams(params)
    return this.http.get<ReservationList>('/v2/reservations', normalized as RequestOptions['params'])
  }

  /**
   * List reservations, filtered by the supplied params. See
   * {@link ReservationFilter} for a fluent builder.
   *
   * @see GET https://public.api.hospitable.com/v2/reservations
   */
  async list(params: ReservationListParams = {}): Promise<ReservationList> {
    const normalized = normalizeListParams(params)
    const key = cacheKey('reservations:list', normalized as unknown as Record<string, unknown>)
    if (this.cache) {
      const cached = this.cache.get(key) as ReservationList | undefined
      if (cached) return cached
    }
    const result = await this.fetchList(params)
    this.cache?.set(key, result)
    return result
  }

  /**
   * Fetch a single reservation by UUID.
   *
   * @see GET https://public.api.hospitable.com/v2/reservations/{id}
   * @throws {NotFoundError} on 404
   */
  async get(id: string, include?: string): Promise<Reservation> {
    const key = cacheKey('reservations:get', { id, include })
    if (this.cache) {
      const cached = this.cache.get(key) as Reservation | undefined
      if (cached) return cached
    }
    const result = await this.http.get<Reservation>(`/v2/reservations/${id}`, include ? { include } : undefined)
    this.cache?.set(key, result)
    return result
  }

  /**
   * Convenience wrapper: accepted reservations on or after today, for the
   * given properties. Equivalent to
   * `list({ properties, startDate: today, status: 'accepted', include })`.
   *
   * Defaults `include` to `'guest,properties'` so agents get a useful
   * payload without needing to remember the include-field list.
   */
  async getUpcoming(
    propertyIds: string[],
    options: { include?: string } = {},
  ): Promise<ReservationList> {
    const today = new Date().toISOString().split('T')[0]!
    return this.list({
      properties: propertyIds,
      startDate: today,
      status: 'accepted',
      include: options.include ?? 'guest,properties',
    })
  }

  /**
   * Stream every reservation matching `params`, auto-paginating through all pages.
   *
   * Memory-efficient — pulls one page at a time. Pair with
   * `collectAll(client.reservations.iter(...))` to drain into an array.
   */
  async *iter(params: Omit<ReservationListParams, 'page'> = {}): AsyncGenerator<Reservation> {
    yield* paginate<Reservation, ReservationListParams>(p => this.fetchList(p), params)
  }

  /** Drop the in-memory cache. Called automatically by the client on 401 re-auth. */
  clearCache(): void {
    this.cache?.clear()
  }
}
