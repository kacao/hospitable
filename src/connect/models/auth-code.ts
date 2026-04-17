/**
 * An AuthCode is a 5-minute magic link used to authenticate a
 * {@link Customer} into Hospitable Connect so they can connect,
 * reconnect, or refresh a channel. The customer must already exist
 * before requesting an auth code.
 *
 * `returnUrl` is the URL to send the customer to.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface AuthCode {
  expiresAt: string
  returnUrl: string
}

/**
 * Request body for `POST /auth-codes`. `customerId` identifies which
 * customer the link authenticates. `redirectUrl` is where Hospitable
 * returns the user after the connect/reconnect flow completes.
 */
export interface CreateAuthCodeInput {
  customerId: string
  /**
   * URL Hospitable redirects the customer to after a successful
   * channel-connection flow. Must be a fully-qualified HTTPS URL.
   */
  redirectUrl?: string
}
