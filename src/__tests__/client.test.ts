import { describe, it, expect, vi, afterEach } from 'vitest'
import { HospitableClient } from '../client'
import { PropertiesResource } from '../resources/properties'
import { ReservationsResource } from '../resources/reservations'
import { MessagesResource } from '../resources/messages'
import { CalendarResource } from '../resources/calendar'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => body,
    }),
  )
}

describe('HospitableClient', () => {
  it('creates client with .properties and .reservations when given a token', () => {
    const client = new HospitableClient({ token: 'pat123' })
    expect(client.properties).toBeDefined()
    expect(client.reservations).toBeDefined()
  })

  it('client.properties is instance of PropertiesResource', () => {
    const client = new HospitableClient({ token: 'pat123' })
    expect(client.properties).toBeInstanceOf(PropertiesResource)
  })

  it('client.reservations is instance of ReservationsResource', () => {
    const client = new HospitableClient({ token: 'pat123' })
    expect(client.reservations).toBeInstanceOf(ReservationsResource)
  })

  it('uses default baseURL https://api.hospitable.com', async () => {
    mockFetch(200, { data: [], meta: { nextCursor: null, total: 0, perPage: 10 } })
    const client = new HospitableClient({ token: 'pat123' })
    await client.properties.list()
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[0]).toContain('https://api.hospitable.com')
  })

  it('passes custom baseURL through to requests', async () => {
    mockFetch(200, { data: [], meta: { nextCursor: null, total: 0, perPage: 10 } })
    const client = new HospitableClient({
      token: 'pat123',
      baseURL: 'https://custom.example.com',
    })
    await client.properties.list()
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[0]).toContain('https://custom.example.com')
  })

  it('accepts debug: true without error', () => {
    expect(() => new HospitableClient({ token: 'pat123', debug: true })).not.toThrow()
  })

  it('constructor with no args does not throw', () => {
    expect(() => new HospitableClient()).not.toThrow()
  })

  it('accepts all OAuth2 config fields without error', () => {
    expect(() => new HospitableClient({
      token: 'access',
      refreshToken: 'refresh',
      clientId: 'cid',
      clientSecret: 'csecret',
      retry: { maxAttempts: 3 },
      debug: false,
    })).not.toThrow()
  })

  it('exposes reviews resource', () => {
    const client = new HospitableClient({ token: 'pat123' })
    expect(client.reviews).toBeDefined()
  })

  it('exposes client.messages (MessagesResource)', () => {
    const client = new HospitableClient({ token: 'pat' })
    expect(client.messages).toBeInstanceOf(MessagesResource)
  })

  it('exposes client.calendar (CalendarResource)', () => {
    const client = new HospitableClient({ token: 'pat' })
    expect(client.calendar).toBeInstanceOf(CalendarResource)
  })

  it('a 401 from the API triggers token refresh and retries the request', async () => {
    // When token+refreshToken+clientId+clientSecret are all provided, TokenManager
    // treats the initial token as needing immediate refresh (expiresAt = now+60s,
    // needsRefresh = now >= now). So the actual call order is:
    //   call 1: /oauth/token (pre-call refresh)
    //   call 2: API request → 401
    //   call 3: /oauth/token (onUnauthorized refresh)
    //   call 4: API retry → 200
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      callCount++
      if (url.includes('/oauth/token')) {
        // Token refresh calls always succeed
        return Promise.resolve({
          ok: true, status: 200,
          headers: new Headers(),
          json: async () => ({ access_token: 'new-token', expires_in: 3600, token_type: 'Bearer' }),
          text: async () => '',
        })
      }
      // First API call → 401; subsequent API calls → 200
      const apiCallNumber = callCount - (callCount > 2 ? 2 : 1)
      if (apiCallNumber === 1) {
        return Promise.resolve({
          ok: false, status: 401,
          headers: new Headers(),
          json: async () => ({ message: 'Unauthorized' }),
          text: async () => 'Unauthorized',
        })
      }
      return Promise.resolve({
        ok: true, status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ data: [], meta: { nextCursor: null, total: 0, perPage: 10 } }),
        text: async () => '',
      })
    }))

    const client = new HospitableClient({
      token: 'old-token',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    })

    const result = await client.properties.list()
    expect(result.data).toEqual([])
    // 1 pre-call token refresh + 1 API call (401) + 1 onUnauthorized token refresh + 1 API retry
    expect(callCount).toBe(4)
  })
})
