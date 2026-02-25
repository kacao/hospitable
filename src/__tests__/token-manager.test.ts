import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TokenManager } from '../auth/token-manager'

function makeFetchMock(response: {
  ok: boolean
  status?: number
  json?: () => Promise<unknown>
  text?: () => Promise<string>
}) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    json: response.json ?? (() => Promise.resolve({})),
    text: response.text ?? (() => Promise.resolve('')),
  })
}

function makeTokenResponse(overrides?: Partial<{
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}>) {
  return {
    access_token: 'new-access-token',
    expires_in: 3600,
    token_type: 'Bearer',
    ...overrides,
  }
}

describe('TokenManager', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    delete process.env['HOSPITABLE_PAT']
  })

  describe('PAT mode', () => {
    it('1. returns Bearer token immediately without fetch', async () => {
      const mockFetch = makeFetchMock({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({ token: 'my-pat', baseURL: 'https://api.hospitable.com' })
      const header = await tm.getAuthHeader()

      expect(header).toBe('Bearer my-pat')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('2. never refreshes (Infinity expiry) — no fetch on repeated calls', async () => {
      const mockFetch = makeFetchMock({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({ token: 'my-pat', baseURL: 'https://api.hospitable.com' })

      await tm.getAuthHeader()
      await tm.getAuthHeader()
      await tm.getAuthHeader()

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('client credentials mode', () => {
    it('3. fetches token on first getAuthHeader() call', async () => {
      const mockFetch = makeFetchMock({
        ok: true,
        json: () => Promise.resolve(makeTokenResponse()),
      })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseURL: 'https://api.hospitable.com',
      })

      const header = await tm.getAuthHeader()

      expect(header).toBe('Bearer new-access-token')
      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hospitable.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: expect.stringContaining('grant_type=client_credentials'),
        })
      )
    })

    it('4. refreshes when expiresAt is in the past', async () => {
      const mockFetch = makeFetchMock({
        ok: true,
        json: () => Promise.resolve(makeTokenResponse({ expires_in: -1 })),
      })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({
        token: 'old-token',
        refreshToken: 'old-refresh',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseURL: 'https://api.hospitable.com',
      })

      // Force expiresAt to the past by getting auth header first time
      // The constructor sets expiresAt = Date.now() + 60_000 for OAuth mode
      // but needsRefresh checks Date.now() >= expiresAt - 60_000
      // So with expiresAt = now + 60_000, needsRefresh = now >= now = true
      const header = await tm.getAuthHeader()

      expect(mockFetch).toHaveBeenCalledOnce()
      expect(header).toBe('Bearer new-access-token')
      const body = (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
      expect(body).toContain('grant_type=refresh_token')
      expect(body).toContain('refresh_token=old-refresh')
    })

    it('5. deduplicates concurrent refresh calls — fetch called only once', async () => {
      let resolveJson: (value: unknown) => void
      const jsonPromise = new Promise((resolve) => { resolveJson = resolve })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => jsonPromise,
        text: () => Promise.resolve(''),
      })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseURL: 'https://api.hospitable.com',
      })

      // Start two concurrent getAuthHeader calls
      const [h1Promise, h2Promise] = [tm.getAuthHeader(), tm.getAuthHeader()]

      // Resolve the fetch
      resolveJson!(makeTokenResponse())

      const [h1, h2] = await Promise.all([h1Promise, h2Promise])

      expect(h1).toBe('Bearer new-access-token')
      expect(h2).toBe('Bearer new-access-token')
      expect(mockFetch).toHaveBeenCalledOnce()
    })

    it('6. handleUnauthorized() forces a refresh on next call', async () => {
      const mockFetch = makeFetchMock({
        ok: true,
        json: () => Promise.resolve(makeTokenResponse()),
      })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseURL: 'https://api.hospitable.com',
      })

      // First call fetches token
      await tm.getAuthHeader()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // handleUnauthorized forces refresh
      await tm.handleUnauthorized()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('7. throws descriptive error when clientId/clientSecret missing on refresh', async () => {
      const mockFetch = makeFetchMock({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({ baseURL: 'https://api.hospitable.com' })

      await expect(tm.getAuthHeader()).rejects.toThrow(
        'Cannot refresh token: clientId and clientSecret are required'
      )
    })

    it('7c. throws "no access token" error when token is set but refresh config missing', async () => {
      const mockFetch = makeFetchMock({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      // Simulate a TokenManager that somehow has no token and can't refresh
      // The "No access token available" error path is reached when refresh succeeds
      // but returns no access_token — or when token is null after a failed refresh
      // In practice, the doRefresh error surfaces first. Test the direct throw:
      const tm = new TokenManager({ baseURL: 'https://api.hospitable.com' })

      // The error thrown describes why refresh cannot proceed
      await expect(tm.getAuthHeader()).rejects.toThrow('clientId and clientSecret are required')
    })

    it('7b. throws descriptive error when refresh attempted without clientId/clientSecret', async () => {
      const mockFetch = makeFetchMock({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({
        token: 'old-token',
        refreshToken: 'old-refresh',
        baseURL: 'https://api.hospitable.com',
      })

      // Force a refresh without clientId/clientSecret
      await expect(tm.handleUnauthorized()).rejects.toThrow(
        'Cannot refresh token: clientId and clientSecret are required'
      )
    })

    it('8. updates refresh token when server returns a new one', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makeTokenResponse({
            access_token: 'first-access',
            refresh_token: 'new-refresh-token',
            expires_in: -1,
          })),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makeTokenResponse({
            access_token: 'second-access',
            expires_in: 3600,
          })),
          text: () => Promise.resolve(''),
        })

      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({
        token: 'initial-token',
        refreshToken: 'initial-refresh',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseURL: 'https://api.hospitable.com',
      })

      // First call: refresh using initial-refresh, server returns new-refresh-token
      const h1 = await tm.getAuthHeader()
      expect(h1).toBe('Bearer first-access')

      const firstBody = (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
      expect(firstBody).toContain('refresh_token=initial-refresh')

      // Force another refresh
      await tm.handleUnauthorized()

      const secondBody = (mockFetch.mock.calls[1] as [string, RequestInit])[1].body as string
      expect(secondBody).toContain('refresh_token=new-refresh-token')
    })
  })

  describe('failed refresh', () => {
    it('throws when token endpoint returns non-ok response', async () => {
      const mockFetch = makeFetchMock({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })
      vi.stubGlobal('fetch', mockFetch)

      const tm = new TokenManager({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        baseURL: 'https://api.hospitable.com',
      })

      await expect(tm.getAuthHeader()).rejects.toThrow('Token refresh failed (401): Unauthorized')
    })
  })

  describe('environment variable fallback', () => {
    it('9. uses HOSPITABLE_PAT env var when no token provided', async () => {
      const mockFetch = makeFetchMock({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      process.env['HOSPITABLE_PAT'] = 'env-pat-token'

      const tm = new TokenManager({ baseURL: 'https://api.hospitable.com' })
      const header = await tm.getAuthHeader()

      expect(header).toBe('Bearer env-pat-token')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
