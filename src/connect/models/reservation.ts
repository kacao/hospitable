import type { ConnectPlatform, Financial } from './shared'

/**
 * Reservation lifecycle status. The API returns freeform strings in
 * practice — kept as an open union. See
 * [[genesis/api_docs/hospitable/connect_api/reference/reference_enums_and_statuses]]
 * for the full enumerated set.
 */
export type ReservationStatus =
  | 'accept'
  | 'request'
  | 'at_checkpoint'
  | 'canceled_by_guest'
  | 'canceled_by_host'
  | 'not_possible'
  | 'checkpoint_voided'
  | 'timeout'
  | 'awaiting_payment'
  | (string & {})

export interface ReservationStatusEntry {
  category: string
  status: string
  createdAt: string
}

export interface ReservationGuestCounts {
  total: number
  adultCount: number
  childCount: number
  infantCount: number
  petCount: number
}

export interface ReservationGuest {
  email: string
  phoneNumbers: string[]
  firstName: string
  lastName: string
  locale: string
}

/**
 * Financial breakdown from the guest's perspective on a reservation.
 * Arrays (`taxes`, `fees`, `discounts`) may be empty.
 */
export interface ReservationFinancialsGuest {
  accommodation: Financial
  cleaningFee: Financial
  serviceFee: Financial
  taxes: Financial[]
  fees: Financial[]
  totalFees: Financial
  discounts: Financial[]
  subtotal: Financial
  totalPrice: Financial
}

/**
 * Financial breakdown from the host's perspective. Includes `payout`
 * instead of `totalPrice` — the net amount the host receives after
 * channel service fees.
 */
export interface ReservationFinancialsHost {
  accommodation: Financial
  cleaningFee: Financial
  serviceFee: Financial
  taxes: Financial[]
  fees: Financial[]
  totalFees: Financial
  discounts: Financial[]
  subtotal: Financial
  payout: Financial
}

export interface ReservationFinancials {
  guest: ReservationFinancialsGuest
  host: ReservationFinancialsHost
}

/**
 * A booking on a Connect listing. `status` snapshots the current state;
 * `statusHistory` chronologically lists every transition.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface Reservation {
  id: string
  platform: ConnectPlatform
  platformId: string
  bookingDate: string
  arrivalDate: string
  departureDate: string
  status: ReservationStatus
  checkInLocal?: string
  checkOutLocal?: string
  timezone?: string
  statusHistory: ReservationStatusEntry[]
  guests: ReservationGuestCounts
  guest: ReservationGuest
  financials: ReservationFinancials
}
