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

export class PropertiesResource {
  private cache: MemoryCache<unknown> | null

  constructor(
    private readonly http: HttpClient,
    cacheConfig?: CacheConfig,
  ) {
    const enabled = cacheConfig?.enabled ?? false
    this.cache = enabled
      ? new MemoryCache({ ttl: cacheConfig?.ttl ?? DEFAULT_TTL, maxSize: cacheConfig?.maxSize })
      : null
  }

  private fetchList(params: PropertyListParams = {}): Promise<PropertyList> {
    return this.http.get<PropertyList>('/v2/properties', params as RequestOptions['params'])
  }

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

  async *iter(params: Omit<PropertyListParams, 'page'> = {}): AsyncGenerator<Property> {
    yield* paginate<Property, PropertyListParams>(p => this.fetchList(p), params)
  }

  clearCache(): void {
    this.cache?.clear()
  }
}
