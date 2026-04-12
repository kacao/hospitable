/**
 * Parameters for requesting a price quote on a property.
 *
 * @see POST https://public.api.hospitable.com/v2/properties/{id}/quote
 */
export interface CreateQuoteParams {
  /** ISO `YYYY-MM-DD` check-in date. */
  checkinDate: string
  /** ISO `YYYY-MM-DD` check-out date. */
  checkoutDate: string
  guests: {
    adults: number
    children?: number
    infants?: number
    pets?: number
  }
  guestDetails?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  promoCode?: string
}

/**
 * Quote response from the API. Typed as `unknown` because the account
 * used for probing lacks the "Direct" feature required to generate quotes.
 * Narrow at the call site once the response shape is observed.
 *
 * @see POST https://public.api.hospitable.com/v2/properties/{id}/quote
 */
export type Quote = unknown
