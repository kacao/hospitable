import type { HttpClient, RequestOptions } from '../http/client'
import type {
  Reservation,
  ReservationList,
  ReservationListParams,
} from '../models/reservation'
import { normalizeReservation } from '../models/reservation'
import { paginate } from '../http/paginate'
import { MemoryCache, cacheKey, type CacheConfig } from '../utils/cache'
import { ConfigurationError } from '../errors'

const DEFAULT_TTL = 60_000

/**
 * Verify that `properties` is present and non-empty. The API requires this
 * field — throwing locally lets agents read the error message and self-correct
 * in one turn instead of round-tripping through a 400.
 *
 * Called from `list()` and `iter()` — the only two public entry points that
 * reach `fetchList()`. The private `fetchList()` trusts its callers rather
 * than re-validating, so the same guard doesn't run twice on a cache miss.
 */
function assertPropertiesPresent(params: ReservationListParams): void {
  if (!params.properties || params.properties.length === 0) {
    throw new ConfigurationError(
      'reservations.list: `properties` is required and must be a non-empty array of property UUIDs. ' +
        'The Hospitable API rejects requests without this filter. ' +
        'Example: client.reservations.list({ properties: [propertyId] }).',
    )
  }
}

function normalizeListParams(params: ReservationListParams) {
  return {
    page: params.page,
    properties: params.properties,
    startDate: params.startDate,
    endDate: params.endDate,
    dateQuery: params.dateQuery,
    lastMessageAt: params.lastMessageAt,
    status: Array.isArray(params.status) ? params.status : params.status ? [params.status] : undefined,
    include: params.include,
    perPage: params.perPage,
  }
}

/**
 * Apply `normalizeReservation` to every entry in a paginated list while
 * preserving the `meta`/`links` wrapper. Returns a fresh wrapper so the
 * caller never mutates the HTTP response identity.
 */
function normalizeList(list: ReservationList): ReservationList {
  return { ...list, data: list.data.map(normalizeReservation) }
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

  /**
   * Private fetcher used by `list()` and `iter()`. Trusts its caller to
   * have already validated `params.properties` via `assertPropertiesPresent`
   * — do not call this directly without validation.
   */
  private async fetchList(params: ReservationListParams): Promise<ReservationList> {
    const normalized = normalizeListParams(params)
    const raw = await this.http.get<ReservationList>(
      '/v2/reservations',
      normalized as RequestOptions['params'],
    )
    return normalizeList(raw)
  }

  /**
   * List reservations, filtered by the supplied params.
   *
   * `params.properties` is required — the API returns 400 without it, so the
   * SDK throws a {@link ConfigurationError} before making the request.
   *
   * Use `dateQuery` to choose whether `startDate`/`endDate` filter against
   * `check_in` (default) or `check_out`. Swap to `'checkout'` to find
   * reservations departing in a window or guests currently in-house — see
   * {@link getInHouse} for the convenience wrapper.
   *
   * Every returned reservation passes through `normalizeReservation()` so
   * the legacy `statusHistory[].status` field uses consistent British
   * spelling (`'cancelled'`, not `'canceled'`) — see the type's JSDoc for
   * the full rationale.
   *
   * @see {@link ReservationFilter} for a fluent builder
   * @see GET https://public.api.hospitable.com/v2/reservations
   * @throws {ConfigurationError} when `properties` is empty or missing
   */
  async list(params: ReservationListParams): Promise<ReservationList> {
    assertPropertiesPresent(params)
    const key = cacheKey(
      'reservations:list',
      normalizeListParams(params) as unknown as Record<string, unknown>,
    )
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
    const raw = await this.http.get<Reservation>(
      `/v2/reservations/${encodeURIComponent(id)}`,
      include ? { include } : undefined,
    )
    const result = normalizeReservation(raw)
    this.cache?.set(key, result)
    return result
  }

  /**
   * Convenience wrapper: accepted reservations arriving on or after today,
   * for the given properties. Equivalent to
   * `list({ properties, startDate: today, status: 'accepted', dateQuery: 'checkin' })`.
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
      dateQuery: 'checkin',
      include: options.include ?? 'guest,properties',
    })
  }

  /**
   * Convenience wrapper: guests **currently in-house** — accepted
   * reservations that have started but not yet ended.
   *
   * Returns a plain `Reservation[]` rather than a paginated wrapper because
   * this method performs a client-side filter and pagination metadata from
   * the upstream response would be misleading (it would count reservations
   * filtered out locally).
   *
   * Implementation: streams `iter()` with `dateQuery: 'checkout'` and
   * `startDate: today` — fetching every reservation whose check-out is
   * today or later (haven't departed yet) — and filters locally to those
   * whose `arrivalDate` is today or earlier (already arrived).
   *
   * The two-filter approach is necessary because the Hospitable API only
   * accepts a single `date_query` at a time, and "in-house" needs
   * constraints on both check-in and check-out.
   *
   * Defaults `include` to `'guest,properties'` so agents have usable data
   * without remembering the include-field list.
   *
   * ⚠️ **Timezone caveat**: "today" is computed from the SDK host's UTC
   * clock (`new Date().toISOString().split('T')[0]`), not from each
   * property's local timezone. For properties in strongly offset
   * timezones (e.g. Hawaii at UTC-10), calling this method during the
   * UTC-boundary window (~0:00–10:00 UTC) can misclassify a same-day
   * turnover by one day — a guest arriving "today" local time may read
   * as arriving "yesterday" UTC, and the filter may either include or
   * exclude them depending on their check-out date. If your properties
   * span multiple timezones and you need millisecond-correct boundary
   * behavior, query `list()` directly with a timezone-aware `today`.
   */
  async getInHouse(
    propertyIds: string[],
    options: { include?: string } = {},
  ): Promise<Reservation[]> {
    const today = new Date().toISOString().split('T')[0]!
    const result: Reservation[] = []
    for await (const r of this.iter({
      properties: propertyIds,
      startDate: today,
      dateQuery: 'checkout',
      status: 'accepted',
      include: options.include ?? 'guest,properties',
    })) {
      if (r.arrivalDate.slice(0, 10) <= today) result.push(r)
    }
    return result
  }

  /**
   * Stream every reservation matching `params`, auto-paginating through all pages.
   *
   * Memory-efficient — pulls one page at a time. Pair with
   * `collectAll(client.reservations.iter(...))` to drain into an array.
   *
   * @throws {ConfigurationError} when `params.properties` is empty or missing
   */
  async *iter(params: Omit<ReservationListParams, 'page'>): AsyncGenerator<Reservation> {
    assertPropertiesPresent(params)
    yield* paginate<Reservation, ReservationListParams>(p => this.fetchList(p), params)
  }

  /** Drop the in-memory cache. Called automatically by the client on 401 re-auth. */
  clearCache(): void {
    this.cache?.clear()
  }
}
