import type { HttpClient, RequestOptions } from '../http/client'
import type {
  Property,
  PropertyImage,
  PropertyList,
  PropertySearchParams,
  PropertyTag,
} from '../models/property'
import { paginate } from '../http/paginate'
import { MemoryCache, cacheKey, type CacheConfig } from '../utils/cache'

const DEFAULT_TTL = 86_400_000

export interface PropertyListParams {
  page?: number
  perPage?: number
  tags?: string[]
  /**
   * Comma-separated include fields. Valid values are members of
   * {@link PropertyIncludeField}: `'user'`, `'listings'`, `'details'`,
   * `'bookings'`. Unknown values are silently ignored by the API — pass
   * only the literals to avoid typos that fail open.
   *
   * Example: `include: 'user,listings,details'`
   */
  include?: string
}

/**
 * Resource for the Hospitable Properties API.
 *
 * Properties rarely change, so this resource's default cache TTL is 24h
 * when caching is enabled. Cache is cleared automatically by the client
 * on 401 re-auth.
 *
 * @see https://developer.hospitable.com/docs/public-api-docs/1i1kr1bhpg0ku-properties-resource
 */
export class PropertiesResource {
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

  private fetchList(params: PropertyListParams = {}): Promise<PropertyList> {
    return this.http.get<PropertyList>('/v2/properties', params as RequestOptions['params'])
  }

  /**
   * List properties, optionally filtered by tags.
   *
   * @see GET https://public.api.hospitable.com/v2/properties
   */
  async list(params: PropertyListParams = {}): Promise<PropertyList> {
    const key = cacheKey('properties:list', params as Record<string, unknown>)
    if (this.cache) {
      const cached = this.cache.get(key) as PropertyList | undefined
      if (cached) return cached
    }
    const result = await this.fetchList(params)
    this.cache?.set(key, result)
    return result
  }

  /**
   * Fetch a single property by UUID.
   *
   * Pass `include` as a comma-separated list of {@link PropertyIncludeField}
   * values — `'user'`, `'listings'`, `'details'`, `'bookings'` — to
   * side-load related data onto the response.
   *
   * **Envelope quirk**: unlike the list endpoint, the single-property
   * response is wrapped in `{data: Property}`. The SDK unwraps it so
   * callers always receive a bare {@link Property}. This is an API-side
   * inconsistency (also present on `/v2/user`), not an SDK bug.
   *
   * @see GET https://public.api.hospitable.com/v2/properties/{id}
   * @throws {NotFoundError} on 404
   */
  async get(id: string, include?: string): Promise<Property> {
    const key = cacheKey('properties:get', { id, include })
    if (this.cache) {
      const cached = this.cache.get(key) as Property | undefined
      if (cached) return cached
    }
    const response = await this.http.get<{ data: Property }>(
      `/v2/properties/${encodeURIComponent(id)}`,
      include ? { include } : undefined,
    )
    const result = response.data
    this.cache?.set(key, result)
    return result
  }

  /**
   * List all tags attached to a given property. These are the structured
   * org-level tags from the tag registry, distinct from the free-text
   * `Property.tags` field inline on the property object.
   *
   * @see GET https://public.api.hospitable.com/v2/properties/{id}/tags
   */
  async listTags(id: string): Promise<PropertyTag[]> {
    const key = cacheKey('properties:tags', { id })
    if (this.cache) {
      const cached = this.cache.get(key) as PropertyTag[] | undefined
      if (cached) return cached
    }
    const response = await this.http.get<{ data: PropertyTag[] }>(
      `/v2/properties/${encodeURIComponent(id)}/tags`,
    )
    this.cache?.set(key, response.data)
    return response.data
  }

  /**
   * Fetch all images attached to a property, ordered by display position.
   *
   * @see GET https://public.api.hospitable.com/v2/properties/{id}/images
   */
  async getImages(id: string): Promise<PropertyImage[]> {
    // Not cached: Hospitable returns pre-signed S3 URLs (typically ~1h
    // expiry) and the properties-resource default TTL is 24h. Caching
    // would serve expired URLs that return 403 Forbidden with no helpful
    // error. Callers who need the array in-memory should hold the
    // promise themselves.
    const response = await this.http.get<{ data: PropertyImage[] }>(
      `/v2/properties/${encodeURIComponent(id)}/images`,
    )
    return response.data
  }

  /**
   * Search for available properties matching a window and party size.
   *
   * All three of `startDate`, `endDate`, and `adults` are **required** by
   * the API — the SDK passes them through as-is and the server returns 400
   * if any are missing.
   *
   * Unlike {@link list}, search results are availability-filtered — only
   * properties that can host the given dates/guests appear.
   *
   * @see GET https://public.api.hospitable.com/v2/properties/search
   */
  async search(params: PropertySearchParams): Promise<PropertyList> {
    return this.http.get<PropertyList>(
      '/v2/properties/search',
      params as unknown as RequestOptions['params'],
    )
  }

  /**
   * Stream every property matching `params`, auto-paginating through all pages.
   *
   * Memory-efficient — pulls one page at a time. Pair with
   * `collectAll(client.properties.iter())` to drain into an array.
   */
  async *iter(params: Omit<PropertyListParams, 'page'> = {}): AsyncGenerator<Property> {
    yield* paginate<Property, PropertyListParams>(p => this.fetchList(p), params)
  }

  /** Drop the in-memory cache. Called automatically by the client on 401 re-auth. */
  clearCache(): void {
    this.cache?.clear()
  }
}
