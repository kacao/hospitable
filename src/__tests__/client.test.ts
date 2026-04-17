import { describe, it, expect, vi, afterEach } from 'vitest'
import { HospitableClient } from '../client'
import { PropertiesResource } from '../resources/properties'
import { ReservationsResource } from '../resources/reservations'
import { MessagesResource } from '../resources/messages'
import { CalendarResource } from '../resources/calendar'
import { InquiriesResource } from '../resources/inquiries'
import { UserResource } from '../resources/user'
import { TransactionsResource } from '../resources/transactions'
import { PayoutsResource } from '../resources/payouts'
import { KnowledgeHubResource } from '../resources/knowledge-hub'

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

  it('uses default baseURL https://public.api.hospitable.com', async () => {
    mockFetch(200, { data: [], meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 0 }, links: { first: null, last: null, prev: null, next: null } })
    const client = new HospitableClient({ token: 'pat123' })
    await client.properties.list()
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fetchCall[0]).toContain('https://public.api.hospitable.com')
  })

  it('passes custom baseURL through to requests', async () => {
    mockFetch(200, { data: [], meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 0 }, links: { first: null, last: null, prev: null, next: null } })
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

  it('exposes client.inquiries (InquiriesResource) — regression guard for 0.4.0 ship-blocker', () => {
    // Earlier in the 0.4.0 cycle, InquiriesResource was exported from the
    // package but never wired into HospitableClient, making every call to
    // `client.inquiries.list(...)` throw TypeError at runtime. This assertion
    // is the canary that prevents that regression from reappearing.
    const client = new HospitableClient({ token: 'pat' })
    expect(client.inquiries).toBeInstanceOf(InquiriesResource)
  })

  it('exposes client.user (UserResource)', () => {
    const client = new HospitableClient({ token: 'pat' })
    expect(client.user).toBeInstanceOf(UserResource)
  })

  it('exposes client.transactions (TransactionsResource)', () => {
    const client = new HospitableClient({ token: 'pat' })
    expect(client.transactions).toBeInstanceOf(TransactionsResource)
  })

  it('exposes client.payouts (PayoutsResource)', () => {
    const client = new HospitableClient({ token: 'pat' })
    expect(client.payouts).toBeInstanceOf(PayoutsResource)
  })

  it('exposes client.knowledgeHub (KnowledgeHubResource)', () => {
    const client = new HospitableClient({ token: 'pat' })
    expect(client.knowledgeHub).toBeInstanceOf(KnowledgeHubResource)
  })

  it('a 401 from the API triggers token refresh and retries the request', async () => {
    // URL-keyed routing (issue #55) — decouples test expectations from call
    // ordering. Prior implementation counted calls and did conditional
    // arithmetic to distinguish token vs. API paths, which silently broke
    // when the refresh cadence changed. Route by URL pattern instead.
    const okPropsResponse = () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        data: [],
        meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 0 },
        links: { first: null, last: null, prev: null, next: null },
      }),
      text: async () => '',
    })
    const tokenRefreshResponse = () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ access_token: 'new-token', expires_in: 3600, token_type: 'Bearer' }),
      text: async () => '',
    })
    const unauthorizedResponse = () => ({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ message: 'Unauthorized' }),
      text: async () => 'Unauthorized',
    })

    // First properties call → 401 to trigger the refresh/retry cycle.
    // All subsequent properties calls → 200.
    const propsCall = vi.fn()
      .mockImplementationOnce(unauthorizedResponse)
      .mockImplementation(okPropsResponse)
    const tokenCall = vi.fn().mockImplementation(tokenRefreshResponse)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/oauth/token')) return Promise.resolve(tokenCall())
        if (url.includes('/properties')) return Promise.resolve(propsCall())
        throw new Error(`unexpected fetch URL: ${url}`)
      }),
    )

    const client = new HospitableClient({
      token: 'old-token',
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    })

    const result = await client.properties.list()
    expect(result.data).toEqual([])
    // Route-level expectations — not order-dependent:
    // - 2 properties requests (first 401, then 200 retry)
    // - 1 token refresh triggered by onUnauthorized
    expect(propsCall).toHaveBeenCalledTimes(2)
    expect(tokenCall).toHaveBeenCalledTimes(1)
  })
})
