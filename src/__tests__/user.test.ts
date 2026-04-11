import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserResource } from '../resources/user'
import type { HttpClient } from '../http/client'
import type { User } from '../models/user'
import { AuthenticationError, NotFoundError, RateLimitError } from '../errors'
import { makeHttpClient } from './helpers'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'host@example.com',
    name: 'Host Name',
    profilePicture: null,
    business: false,
    company: null,
    vat: null,
    taxId: null,
    streetLine1: null,
    streetLine2: null,
    postalCode: null,
    city: null,
    state: null,
    country: null,
    ...overrides,
  }
}

describe('UserResource', () => {
  let http: HttpClient
  let resource: UserResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new UserResource(http)
  })

  it('calls GET /v2/user', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: makeUser() })
    await resource.get()
    expect(http.get).toHaveBeenCalledWith('/v2/user')
  })

  it('unwraps the .data envelope', async () => {
    const user = makeUser({ id: 'user-42', email: 'a@b.com' })
    vi.mocked(http.get).mockResolvedValue({ data: user })
    const result = await resource.get()
    expect(result.id).toBe('user-42')
    expect(result.email).toBe('a@b.com')
  })

  it('returns business fields when populated', async () => {
    const user = makeUser({
      business: true,
      company: 'Acme Rentals LLC',
      taxId: '12-3456789',
      streetLine1: '123 Main St',
      city: 'Anytown',
      postalCode: '12345',
    })
    vi.mocked(http.get).mockResolvedValue({ data: user })
    const result = await resource.get()
    expect(result.business).toBe(true)
    expect(result.company).toBe('Acme Rentals LLC')
    expect(result.taxId).toBe('12-3456789')
  })

  it('handles personal accounts with null business fields', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: makeUser() })
    const result = await resource.get()
    expect(result.business).toBe(false)
    expect(result.company).toBe(null)
    expect(result.taxId).toBe(null)
  })

  describe('error propagation', () => {
    it('throws AuthenticationError on 401', async () => {
      vi.mocked(http.get).mockRejectedValue(new AuthenticationError('Invalid token'))
      await expect(resource.get()).rejects.toBeInstanceOf(AuthenticationError)
    })

    it('throws NotFoundError on 404', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Not found'))
      await expect(resource.get()).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError with retryAfter', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.get().catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })
  })
})
