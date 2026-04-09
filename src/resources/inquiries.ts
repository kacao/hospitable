import type { HttpClient, RequestOptions } from '../http/client'
import type {
  Inquiry,
  InquiryList,
  InquiryListParams,
} from '../models/inquiry'
import { normalizeInquiry } from '../models/inquiry'
import { paginate } from '../http/paginate'
import { MemoryCache, cacheKey, type CacheConfig } from '../utils/cache'

const DEFAULT_TTL = 60_000

function normalizeListParams(params: InquiryListParams) {
  return {
    page: params.page,
    properties: params.properties,
    include: params.include,
    lastMessageAt: params.lastMessageAt,
    perPage: params.perPage,
  }
}

/**
 * Resource for the Hospitable Inquiries API — pre-booking conversations.
 *
 * Note: an inquiry's `id` is also the conversation ID, so you can pass it
 * directly to `client.messages.list(inquiry.id)` to fetch the message thread.
 *
 * @see https://developer.hospitable.com/docs/public-api-docs/9lujw5cgctxti-get-inquiries
 * @see https://developer.hospitable.com/docs/public-api-docs/yczg8erku08qw-get-inquiry-by-uuid
 */
export class InquiriesResource {
  private cache: MemoryCache<unknown> | null

  constructor(
    private readonly http: HttpClient,
    cacheConfig?: CacheConfig,
  ) {
    const enabled = cacheConfig?.enabled ?? false
    this.cache = enabled
      ? new MemoryCache({
          ttl: cacheConfig?.ttl ?? DEFAULT_TTL,
          ...(cacheConfig?.maxSize !== undefined ? { maxSize: cacheConfig.maxSize } : {}),
        })
      : null
  }

  private async fetchList(params: InquiryListParams): Promise<InquiryList> {
    const normalized = normalizeListParams(params)
    const response = await this.http.get<InquiryList>(
      '/v2/inquiries',
      normalized as RequestOptions['params'],
    )
    // Return a fresh wrapper rather than mutating the value returned by
    // `http.get` — callers expect the HTTP client's return value to be
    // treated as immutable.
    return { ...response, data: response.data.map(normalizeInquiry) }
  }

  /**
   * List inquiries for the given properties.
   *
   * `params.properties` is required by the API — enforced at the type level.
   * Each returned inquiry is passed through {@link normalizeInquiry}, so the
   * `property` alias is populated alongside the raw `properties` field when
   * `include=properties` is requested.
   *
   * @see GET https://public.api.hospitable.com/v2/inquiries
   */
  async list(params: InquiryListParams): Promise<InquiryList> {
    const normalized = normalizeListParams(params)
    const key = cacheKey('inquiries:list', normalized as unknown as Record<string, unknown>)
    if (this.cache) {
      const cached = this.cache.get(key) as InquiryList | undefined
      if (cached) return cached
    }
    const result = await this.fetchList(params)
    this.cache?.set(key, result)
    return result
  }

  /**
   * Fetch a single inquiry by UUID (which is the conversation ID).
   *
   * The optional `include` parameter accepts a comma-separated list of:
   * `financials`, `guest`, `properties`, `listings`, `messages`. Note that
   * `messages` is only supported on this endpoint, not on {@link list}.
   *
   * @see GET https://public.api.hospitable.com/v2/inquiries/{uuid}
   * @throws {NotFoundError} on 404 (inquiry does not exist)
   * @throws {HospitableError} on 410 (inquiry has been deleted upstream)
   * @throws {ServerError} on 5xx after retries are exhausted
   */
  async get(uuid: string, include?: string): Promise<Inquiry> {
    const key = cacheKey('inquiries:get', { uuid, include })
    if (this.cache) {
      const cached = this.cache.get(key) as Inquiry | undefined
      if (cached) return cached
    }
    const result = await this.http.get<Inquiry>(
      `/v2/inquiries/${uuid}`,
      include ? { include } : undefined,
    )
    const normalized = normalizeInquiry(result)
    this.cache?.set(key, normalized)
    return normalized
  }

  /**
   * Stream every inquiry matching `params`, auto-paginating through all pages.
   *
   * Memory-efficient — pulls one page at a time. Pass the same params you'd
   * pass to {@link list}, minus `page` which is managed by the generator.
   *
   * @see GET https://public.api.hospitable.com/v2/inquiries
   */
  async *iter(params: Omit<InquiryListParams, 'page'>): AsyncGenerator<Inquiry> {
    yield* paginate<Inquiry, InquiryListParams>(p => this.fetchList(p), params)
  }

  /** Drop the in-memory cache. Called automatically by the client on 401 re-auth. */
  clearCache(): void {
    this.cache?.clear()
  }
}
