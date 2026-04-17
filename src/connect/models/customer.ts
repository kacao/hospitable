/**
 * A Customer represents a single user of the partner application. Each
 * customer owns zero or more {@link Channel} connections. Partner-chosen
 * IDs are allowed — pass any stable string in `id` at creation.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface Customer {
  id: string
  email: string
  name: string
  phone: string
  /** IPv4 of the end-user at channel-connection time. `null` if unknown. */
  ipAddress: string | null
  /** IANA timezone identifier, e.g. `'UTC'`, `'America/Los_Angeles'`. */
  timezone: string
}

/**
 * Request body for `POST /customers`. The partner provides `id` as a
 * stable external identifier (their own user ID); the other fields seed
 * the channel-connection flow.
 */
export interface CreateCustomerInput {
  id: string
  email: string
  name: string
  phone: string
  timezone: string
}
