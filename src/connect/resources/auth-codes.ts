import type { HttpClient } from '../../http/client'
import type { AuthCode, CreateAuthCodeInput } from '../models/auth-code'

/**
 * Resource for the Connect Auth Codes API.
 *
 * Auth codes are 5-minute magic links used to authenticate a Customer
 * into Hospitable Connect. The customer must already exist before
 * requesting a code.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class AuthCodesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create an auth code for a customer. Returns the magic-link URL to
   * send the customer to and its absolute expiry timestamp (5 minutes).
   *
   * @see POST https://connect.hospitable.com/api/v1/auth-codes
   */
  async create(input: CreateAuthCodeInput): Promise<AuthCode> {
    const response = await this.http.post<{ data: AuthCode }>('/auth-codes', input)
    return response.data
  }
}
