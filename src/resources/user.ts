import type { HttpClient } from '../http/client'
import type { User } from '../models/user'

/**
 * Resource for the single-user `/v2/user` endpoint.
 *
 * Returns the authenticated account's identity + business profile. This is
 * the canonical "who am I" call — agents can use it to discover the
 * account's company metadata, billing address, and host identity without
 * scraping it from a reservation include.
 *
 * **Envelope quirk**: unlike `/v2/properties/{id}` which returns the
 * resource object directly, `/v2/user` wraps its response in `{data: ...}`.
 * The SDK unwraps this envelope so callers get a bare {@link User} object.
 * This is an API-side inconsistency, not an SDK bug — see
 * `examples/probe-api-surface.ts` for the raw shape.
 *
 * **Not cached**: user identity changes rarely but not never (business
 * profile edits, email changes). The SDK does not cache this response; if
 * you're calling it in a hot loop, hoist the result yourself.
 *
 * @see GET https://public.api.hospitable.com/v2/user
 */
export class UserResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch the authenticated user's profile and business info.
   *
   * @see GET https://public.api.hospitable.com/v2/user
   */
  async get(): Promise<User> {
    const response = await this.http.get<{ data: User }>('/v2/user')
    return response.data
  }
}
