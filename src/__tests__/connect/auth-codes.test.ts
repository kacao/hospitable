import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthCodesResource } from '../../connect/resources/auth-codes'
import type { HttpClient } from '../../http/client'
import type { AuthCode } from '../../connect/models'
import { makeHttpClient } from '../helpers'

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
})
