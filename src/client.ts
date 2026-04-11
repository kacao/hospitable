import { TokenManager } from './auth'
import type { TokenManagerConfig } from './auth'
import { HttpClient } from './http/client'
import type { RetryConfig } from './http/retry'
import type { CacheConfig } from './utils/cache'
import { CalendarResource } from './resources/calendar'
import { InquiriesResource } from './resources/inquiries'
import { MessagesResource } from './resources/messages'
import { PropertiesResource } from './resources/properties'
import { ReservationsResource } from './resources/reservations'
import { ReviewsResource } from './resources/reviews'
import { UserResource } from './resources/user'
import { TransactionsResource } from './resources/transactions'
import { PayoutsResource } from './resources/payouts'

export interface ResourceCacheConfig {
  properties?: CacheConfig
  reservations?: CacheConfig
  inquiries?: CacheConfig
}

export interface HospitableClientConfig {
  /** Personal Access Token. Also read from HOSPITABLE_API_PAT env var. */
  token?: string
  /** OAuth2 refresh token */
  refreshToken?: string
  /** OAuth2 client ID */
  clientId?: string
  /** OAuth2 client secret */
  clientSecret?: string
  /** API base URL. Defaults to https://public.api.hospitable.com */
  baseURL?: string
  /** Retry configuration */
  retry?: RetryConfig
  /** Enable debug logging */
  debug?: boolean
  /** Cache configuration per resource */
  cache?: ResourceCacheConfig
}

export class HospitableClient {
  readonly properties: PropertiesResource
  readonly reservations: ReservationsResource
  readonly calendar: CalendarResource
  readonly messages: MessagesResource
  readonly reviews: ReviewsResource
  readonly inquiries: InquiriesResource
  readonly user: UserResource
  readonly transactions: TransactionsResource
  readonly payouts: PayoutsResource

  constructor(config: HospitableClientConfig = {}) {
    const baseURL = config.baseURL ?? 'https://public.api.hospitable.com'

    const tokenConfig: TokenManagerConfig = {
      ...(config.token !== undefined ? { token: config.token } : {}),
      ...(config.refreshToken !== undefined ? { refreshToken: config.refreshToken } : {}),
      ...(config.clientId !== undefined ? { clientId: config.clientId } : {}),
      ...(config.clientSecret !== undefined ? { clientSecret: config.clientSecret } : {}),
      baseURL,
    }

    const tokenManager = new TokenManager(tokenConfig)

    const httpClient = new HttpClient({
      baseURL,
      getAuthHeader: () => tokenManager.getAuthHeader(),
      onUnauthorized: async () => {
        await tokenManager.handleUnauthorized()
        this.properties.clearCache()
        this.reservations.clearCache()
        this.inquiries.clearCache()
      },
      ...(config.debug !== undefined ? { debug: config.debug } : {}),
      ...(config.retry !== undefined ? { retryConfig: config.retry } : {}),
    })

    this.properties = new PropertiesResource(httpClient, config.cache?.properties)
    this.reservations = new ReservationsResource(httpClient, config.cache?.reservations)
    this.calendar = new CalendarResource(httpClient)
    this.messages = new MessagesResource(httpClient)
    this.reviews = new ReviewsResource(httpClient)
    this.inquiries = new InquiriesResource(httpClient, config.cache?.inquiries)
    this.user = new UserResource(httpClient)
    this.transactions = new TransactionsResource(httpClient)
    this.payouts = new PayoutsResource(httpClient)
  }
}
