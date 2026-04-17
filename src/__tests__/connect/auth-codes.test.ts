import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthCodesResource } from '../../connect/resources/auth-codes'
import type { HttpClient } from '../../http/client'
import type { AuthCode } from '../../connect/models'
import { makeHttpClient } from '../helpers'
import {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../../errors'

describe('AuthCodesResource', () => {
  let http: HttpClient
  let resource: AuthCodesResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new AuthCodesResource(http)
  })

  it('create() posts /auth-codes and unwraps data envelope', async () => {
    const authCode: AuthCode = {
      expiresAt: '2026-04-16T12:00:00Z',
      returnUrl: 'https://connect.hospitable.com/connect/authenticate/abc',
    }
    vi.mocked(http.post).mockResolvedValue({ data: authCode })

    const result = await resource.create({ customerId: 'cust-1' })

    expect(http.post).toHaveBeenCalledWith('/auth-codes', { customerId: 'cust-1' })
    expect(result).toEqual(authCode)
  })

  it('create() forwards redirectUrl when provided', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: { expiresAt: 'x', returnUrl: 'y' },
    })
    await resource.create({ customerId: 'cust-1', redirectUrl: 'https://app.example.com/cb' })
    expect(http.post).toHaveBeenCalledWith('/auth-codes', {
      customerId: 'cust-1',
      redirectUrl: 'https://app.example.com/cb',
    })
  })

  describe('failure and rate-limit (AGENTS.md triple)', () => {
    it('create() propagates ValidationError on 422 (bad customerId)', async () => {
      vi.mocked(http.post).mockRejectedValue(
        new ValidationError('Invalid customer', { customerId: ['must be a UUID'] }),
      )
      await expect(resource.create({ customerId: 'not-a-uuid' })).rejects.toBeInstanceOf(
        ValidationError,
      )
    })

    it('create() propagates NotFoundError on 404', async () => {
      vi.mocked(http.post).mockRejectedValue(new NotFoundError('customer not found'))
      await expect(resource.create({ customerId: 'ghost' })).rejects.toBeInstanceOf(NotFoundError)
    })

    it('create() propagates AuthenticationError on 401', async () => {
      vi.mocked(http.post).mockRejectedValue(new AuthenticationError('token expired'))
      await expect(resource.create({ customerId: 'cust-1' })).rejects.toBeInstanceOf(
        AuthenticationError,
      )
    })

    it('create() propagates RateLimitError on 429 with retryAfter preserved', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(7))
      await expect(resource.create({ customerId: 'cust-1' })).rejects.toMatchObject({
        statusCode: 429,
        retryAfter: 7,
      })
    })
  })
})
