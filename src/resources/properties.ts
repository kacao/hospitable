import type { HttpClient, RequestOptions } from '../http/client'
import type { Property, PropertyList, PropertyTag } from '../models/property'
import { paginate } from '../http/paginate'
import { MemoryCache, cacheKey, type CacheConfig } from '../utils/cache'

const DEFAULT_TTL = 86_400_000

export interface PropertyListParams {
  page?: number
  perPage?: number
  tags?: string[]
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
   * @see GET https://public.api.hospitable.com/v2/properties/{id}
   * @throws {NotFoundError} on 404
   */
  async get(id: string): Promise<Property> {
    const key = cacheKey('properties:get', { id })
    if (this.cache) {
      const cached = this.cache.get(key) as Property | undefined
      if (cached) return cached
    }
    const result = await this.http.get<Property>(`/v2/properties/${id}`)
    this.cache?.set(key, result)
    return result
  }

  /**
   * List all tags attached to a given property.
   *
   * @see GET https://public.api.hospitable.com/v2/properties/{id}/tags
   */
  async listTags(id: string): Promise<PropertyTag[]> {
    const key = cacheKey('properties:tags', { id })
    if (this.cache) {
      const cached = this.cache.get(key) as PropertyTag[] | undefined
      if (cached) return cached
    }
    const response = await this.http.get<{ data: PropertyTag[] }>(`/v2/properties/${id}/tags`)
    this.cache?.set(key, response.data)
    return response.data
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
