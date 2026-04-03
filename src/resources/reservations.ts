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

  async *iter(params: Omit<ReservationListParams, 'page'> = {}): AsyncGenerator<Reservation> {
    yield* paginate<Reservation, ReservationListParams>(p => this.fetchList(p), params)
  }

  clearCache(): void {
    this.cache?.clear()
  }
}
