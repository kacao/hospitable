import type { Financial } from './shared'

/**
 * A transaction line item — a single guest-side or host-side charge on
 * the payment ledger. `type` is an open string (values seen:
 * `'Reservation'`, `'Adjustment'`, `'Resolution'`). `date` is when the
 * transaction posted; `startDate` is the service date (often the
 * reservation arrival).
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface Transaction {
  id: string
  type: string
  details: string | null
  reference: string | null
  currency: string
  amount: Financial
  date: string
  startDate: string
}
