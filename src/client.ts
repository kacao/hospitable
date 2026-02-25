import { TokenManager } from './auth'
import type { TokenManagerConfig } from './auth'
import { HttpClient } from './http/client'
import type { RetryConfig } from './http/retry'
import { PropertiesResource } from './resources/properties'
import { ReservationsResource } from './resources/reservations'

export interface HospitableClientConfig {
  /** Personal Access Token. Also read from HOSPITABLE_PAT env var. */
  token?: string
  /** OAuth2 refresh token */
  refreshToken?: string
  /** OAuth2 client ID */
  clientId?: string
  /** OAuth2 client secret */
  clientSecret?: string
  /** API base URL. Defaults to https://api.hospitable.com */
  baseURL?: string
  /** Retry configuration */
  retry?: RetryConfig
  /** Enable debug logging */
  debug?: boolean
}

export class HospitableClient {
  readonly properties: PropertiesResource
  readonly reservations: ReservationsResource

  constructor(config: HospitableClientConfig = {}) {
    const baseURL = config.baseURL ?? 'https://api.hospitable.com'

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
      ...(config.debug !== undefined ? { debug: config.debug } : {}),
      ...(config.retry !== undefined ? { retryConfig: config.retry } : {}),
    })

    this.properties = new PropertiesResource(httpClient)
    this.reservations = new ReservationsResource(httpClient)
  }
}
