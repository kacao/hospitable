import type { Channel } from './channel'
import type { Financial } from './shared'
import type { Transaction } from './transaction'

/**
 * A payout represents a single bank transfer from the OTA to the host.
 * `transactions` is the ledger of items rolled into this payout.
 * `date` is when the transfer was initiated; `null` while pending.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface Payout {
  id: string
  platform: string
  platformId: string
  bankAccount: string | null
  reference: string | null
  amount: Financial
  date: string | null
  channel: Channel
  transactions: Transaction[]
}
