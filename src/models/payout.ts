import type { Money } from './transaction'

/**
 * A payout — money disbursed from the platform to the host's bank account.
 *
 * Payouts are a narrower view than {@link Transaction} — they represent
 * the actual bank-transfer events, not the underlying rental income.
 *
 * @see GET https://public.api.hospitable.com/v2/payouts
 */
export interface Payout {
  id: string
  platform: string
  /** Platform's payout identifier (e.g. Airbnb's `G-...`). */
  platformId: string
  /** Human-readable bank account display, e.g. `"LLC Checking ••4169 (USD)"`. */
  bankAccount: string
  reference: string | null
  amount: Money
  /** ISO 8601 timestamp of when the payout was disbursed. */
  date: string
  /** Populated when `include=transactions` is requested. */
  transactions?: unknown[]
}

export type PayoutList = import('./pagination').PaginatedResponse<Payout>

export interface PayoutListParams {
  /** ISO `YYYY-MM-DD` — lower bound on payout date. */
  startDate?: string
  /** ISO `YYYY-MM-DD` — upper bound on payout date. */
  endDate?: string
  /** Scope to specific property UUIDs. */
  properties?: string[]
  page?: number
  perPage?: number
}
