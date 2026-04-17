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
}

/**
 * Client for the Hospitable Connect API — partner-facing, multi-customer
 * integration surface. Distinct from {@link HospitableClient} (Public API,
 * host-facing).
 *
 * Auth is a static bearer token minted in the Hospitable Partner Portal;
 * there is no OAuth refresh loop. 401s surface as
 * {@link AuthenticationError} — regenerate the token in the portal and
 * reconstruct the client.
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

    const http = new HttpClient({
      baseURL,
      getAuthHeader: async () => `Bearer ${token}`,
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
