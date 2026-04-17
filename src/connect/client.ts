import { HttpClient } from '../http/client'
import type { RetryConfig } from '../http/retry'
import { ConfigurationError } from '../errors'
import { AuthCodesResource } from './resources/auth-codes'
import { CustomersResource } from './resources/customers'
import { ChannelsResource } from './resources/channels'
import { ListingsResource } from './resources/listings'
import { ReservationsResource } from './resources/reservations'
import { MessagingResource } from './resources/messaging'
import { ReviewsResource } from './resources/reviews'
import { TransactionsResource } from './resources/transactions'
import { PayoutsResource } from './resources/payouts'
import { ResolutionsResource } from './resources/resolutions'

declare const process: { env: Record<string, string | undefined> }

export interface HospitableConnectClientConfig {
  /**
   * Partner-portal bearer token. Also read from `HOSPITABLE_CONNECT_TOKEN`
   * env var. Generate in partners.hospitable.com → Connect → Settings →
   * Access tokens (shown only once — store securely).
   */
  token?: string
  /** API base URL. Defaults to `https://connect.hospitable.com/api/v1`. */
  baseURL?: string
  /** Retry configuration. Connect rate-limits at 60 req/min per vendor. */
  retry?: RetryConfig
  /** Enable debug logging. */
  debug?: boolean
  /**
   * Optional callback invoked when a 401 is returned by the API. Should
   * resolve to a freshly-minted bearer token, which the SDK will swap in
   * and use to transparently retry the failing request.
   *
   * Without this callback, 401s throw {@link AuthenticationError} and the
   * caller must reconstruct the client — fine for short-lived scripts but
   * a dead-end for long-running agent processes that rotate tokens
   * mid-session. Supply it to cover that case.
   *
   * @example
   * ```ts
   * new HospitableConnectClient({
   *   token: initialToken,
   *   onTokenExpired: () => fetchFreshConnectToken(),
   * })
   * ```
   */
  onTokenExpired?: () => string | Promise<string>
}

/**
 * Client for the Hospitable Connect API — partner-facing, multi-customer
 * integration surface. Distinct from {@link HospitableClient} (Public API,
 * host-facing).
 *
 * Auth is a static bearer token minted in the Hospitable Partner Portal;
 * there is no OAuth refresh loop. By default, 401s surface as
 * {@link AuthenticationError} and are terminal — regenerate the token in
 * the portal and reconstruct the client. Supply {@link HospitableConnectClientConfig.onTokenExpired}
 * to plug in a custom refresh path (e.g. for long-running agents that
 * rotate tokens via an external system).
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class HospitableConnectClient {
  readonly authCodes: AuthCodesResource
  readonly customers: CustomersResource
  readonly channels: ChannelsResource
  readonly listings: ListingsResource
  readonly reservations: ReservationsResource
  readonly messaging: MessagingResource
  readonly reviews: ReviewsResource
  readonly transactions: TransactionsResource
  readonly payouts: PayoutsResource
  readonly resolutions: ResolutionsResource

  constructor(config: HospitableConnectClientConfig = {}) {
    const baseURL = config.baseURL ?? 'https://connect.hospitable.com/api/v1'

    const token = config.token ?? process.env['HOSPITABLE_CONNECT_TOKEN']
    if (!token || token.length === 0) {
      throw new ConfigurationError(
        'HospitableConnectClient: `token` is required. Pass it to the ' +
          'constructor or set HOSPITABLE_CONNECT_TOKEN. Mint the token in ' +
          'the Hospitable Partner Portal under Connect → Settings → Access tokens.',
      )
    }

    // Hold the current token in a mutable ref so `onTokenExpired` can rotate
    // it in place without reconstructing the client. `getAuthHeader` reads
    // through the ref on every request.
    let currentToken = token

    const http = new HttpClient({
      baseURL,
      getAuthHeader: async () => `Bearer ${currentToken}`,
      ...(config.onTokenExpired !== undefined
        ? {
            onUnauthorized: async () => {
              currentToken = await config.onTokenExpired!()
            },
          }
        : {}),
      ...(config.debug !== undefined ? { debug: config.debug } : {}),
      ...(config.retry !== undefined ? { retryConfig: config.retry } : {}),
    })

    this.authCodes = new AuthCodesResource(http)
    this.customers = new CustomersResource(http)
    this.channels = new ChannelsResource(http)
    this.listings = new ListingsResource(http)
    this.reservations = new ReservationsResource(http)
    this.messaging = new MessagingResource(http)
    this.reviews = new ReviewsResource(http)
    this.transactions = new TransactionsResource(http)
    this.payouts = new PayoutsResource(http)
    this.resolutions = new ResolutionsResource(http)
  }
}
