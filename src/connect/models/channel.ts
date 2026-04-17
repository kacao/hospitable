import type { ConnectPlatform } from './shared'

/**
 * A Channel represents an established connection with an OTA (currently
 * only Airbnb) via a customer's Hospitable account. Channels are
 * created through the auth-code / magic-link flow and subsequently
 * sync listings, reservations, and reviews.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface Channel {
  id: string
  platform: ConnectPlatform
  platformId: string
  name: string
  picture: string | null
  location: string | null
  description: string | null
  firstConnectedAt: string
  /**
   * `true` when the customer's channel has already been connected to a
   * full Hospitable account (indicating the customer could be migrated
   * from Connect to a direct Hospitable subscription). `null` when the
   * platform has not computed this flag.
   */
  readyToMigrate: boolean | null
}
