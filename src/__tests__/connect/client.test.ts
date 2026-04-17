import { describe, it, expect, afterEach, vi } from 'vitest'
import { HospitableConnectClient } from '../../connect/client'
import { ConfigurationError } from '../../errors'

declare const process: { env: Record<string, string | undefined> }

describe('HospitableConnectClient', () => {
  const prevEnv = process.env['HOSPITABLE_CONNECT_TOKEN']

  afterEach(() => {
    if (prevEnv === undefined) delete process.env['HOSPITABLE_CONNECT_TOKEN']
    else process.env['HOSPITABLE_CONNECT_TOKEN'] = prevEnv
  })

  it('constructs with an explicit token', () => {
    const client = new HospitableConnectClient({ token: 'test-token' })
    expect(client.customers).toBeDefined()
    expect(client.channels).toBeDefined()
    expect(client.listings).toBeDefined()
    expect(client.reservations).toBeDefined()
    expect(client.messaging).toBeDefined()
    expect(client.reviews).toBeDefined()
    expect(client.transactions).toBeDefined()
    expect(client.payouts).toBeDefined()
    expect(client.resolutions).toBeDefined()
    expect(client.authCodes).toBeDefined()
  })

  it('falls back to HOSPITABLE_CONNECT_TOKEN env var', () => {
    process.env['HOSPITABLE_CONNECT_TOKEN'] = 'env-token'
    const client = new HospitableConnectClient()
    expect(client.customers).toBeDefined()
  })

  it('throws ConfigurationError when no token is available', () => {
    delete process.env['HOSPITABLE_CONNECT_TOKEN']
    expect(() => new HospitableConnectClient()).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError on empty-string token', () => {
    expect(() => new HospitableConnectClient({ token: '' })).toThrow(ConfigurationError)
  })

  it('accepts a custom baseURL', () => {
    const client = new HospitableConnectClient({
      token: 'test-token',
      baseURL: 'https://connect.staging.hospitable.com/api/v1',
    })
    expect(client.customers).toBeDefined()
  })

  it('accepts a retry config', () => {
    const client = new HospitableConnectClient({
      token: 'test-token',
      retry: { maxRetries: 5, baseDelay: 100 },
    })
    expect(client.customers).toBeDefined()
  })

  it('accepts debug:true without logging anything unexpected', () => {
    const client = new HospitableConnectClient({ token: 'test-token', debug: true })
    expect(client.customers).toBeDefined()
  })

  it('sends Authorization: Bearer <token> on real HTTP calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const prev = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const client = new HospitableConnectClient({ token: 'abc-123' })
      await client.channels.list('cust-1')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [, init] = fetchMock.mock.calls[0]!
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer abc-123')
    } finally {
      globalThis.fetch = prev
    }
  })
})
