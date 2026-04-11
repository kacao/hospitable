/**
 * Authenticated user and business/billing info returned by `GET /v2/user`.
 *
 * This is the single "who am I" endpoint — useful for agents to discover
 * the account's company metadata, billing address, and host identity
 * without scraping it from a reservation include.
 *
 * @see GET https://public.api.hospitable.com/v2/user
 */
export interface User {
  id: string
  email: string
  name: string
  profilePicture: string | null

  // Business / billing fields — populated when the account has a business
  // profile configured. For personal (non-business) accounts, most of
  // these will be null or empty strings.

  /** `true` when the account is configured as a business entity. */
  business: boolean
  /** Registered company name, if any. */
  company: string | null
  /** VAT identifier (European accounts). */
  vat: string | null
  /** Tax ID (e.g. EIN in the US). */
  taxId: string | null

  /** Billing address line 1. */
  streetLine1: string | null
  /** Billing address line 2. */
  streetLine2: string | null
  postalCode: string | null
  city: string | null
  state: string | null
  country: string | null
}
