/**
 * A money amount with currency metadata. The API returns these as nested
 * objects rather than primitive numbers so you get the pre-formatted
 * display string alongside the raw integer (cents).
 */
export interface Money {
  /** Amount in minor currency units (cents for USD, pence for GBP, etc.). */
  amount: number
  /** Pre-formatted display string, e.g. `"$191.48"`. */
  formatted: string
  /** ISO 4217 currency code. */
  currency: string
}

/**
 * A financial transaction — rent collected, payout issued, refund, etc.
 *
 * The Hospitable API mixes several transaction kinds under the same
 * endpoint. Check {@link Transaction.type} to distinguish.
 *
 * @see GET https://public.api.hospitable.com/v2/transactions
 */
export interface Transaction {
  id: string
  platform: string
  /**
   * Transaction kind. Values seen: `"Payout"`, `"Rent"`, `"Refund"`,
   * `"Adjustment"`. Kept as open string union.
   */
  type: string
  /** Free-text description, e.g. bank account "••4169 (USD)". */
  details: string | null
  /** Platform-provided reference/external id. */
  reference: string | null
  /** ISO 4217 currency code. */
  currency: string
  /**
   * Raw amount. The API sometimes returns `null` here when
   * {@link paidOutAmount} is used instead (e.g. for Payout rows). Prefer
   * reading both fields and falling through.
   */
  amount: number | null
  /** Structured amount for payout rows. */
  paidOutAmount: Money | null
  /** Transaction date (ISO 8601). */
  date: string
  /** Start of the period this transaction covers, for range-based rows. */
  startDate: string | null
  /** Populated when `include=payout` is requested. */
  payout?: unknown
  /** Populated when `include=reservation` is requested. */
  reservation?: unknown
}

export type TransactionList = import('./pagination').PaginatedResponse<Transaction>

export interface TransactionListParams {
  /** ISO `YYYY-MM-DD` — lower bound on transaction date. */
  startDate?: string
  /** ISO `YYYY-MM-DD` — upper bound on transaction date. */
  endDate?: string
  /** Scope to specific property UUIDs. */
  properties?: string[]
  page?: number
  perPage?: number
}
