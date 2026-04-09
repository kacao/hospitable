import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../http/client'
import {
  HospitableError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
} from '../errors'
import { VERSION } from '../index'

const BASE_URL = 'https://public.api.hospitable.com'
const AUTH_HEADER = 'Bearer test-token'

function makeClient(debug = false) {
  return new HttpClient({
    baseURL: BASE_URL,
    getAuthHeader: async () => AUTH_HEADER,
    debug,
    retryConfig: { maxAttempts: 1 },
  })
}

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const responseHeaders = new Headers({ 'Content-Type': 'application/json', ...headers })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: responseHeaders,
      json: async () => body,
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HttpClient', () => {
  describe('User-Agent header', () => {
    it('always sends correct User-Agent header', async () => {
      mockFetch(200, { id: 1 })
      const client = makeClient()
      await client.get('/listings')
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const headers = fetchCall[1].headers as Record<string, string>
      expect(headers['User-Agent']).toBe(`hospitable-ts/${VERSION}`)
    })
  })

  describe('query params', () => {
    it('serializes simple params', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/listings', { page: 1, active: true, q: 'beach' })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toContain('page=1')
      expect(url).toContain('active=true')
      expect(url).toContain('q=beach')
    })

    it('serializes array params as repeated keys with [] suffix', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/listings', { ids: ['a', 'b', 'c'] })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const parsed = new URL(url)
      expect(parsed.searchParams.getAll('ids[]')).toEqual(['a', 'b', 'c'])
    })

    it('transforms snake_case response keys to camelCase', async () => {
      mockFetch(200, { listing_id: 'abc', start_date: '2026-01-01', nested: { some_key: 'value' } })
      const client = makeClient()
      const result = await client.get<Record<string, unknown>>('/listings')
      expect(result).toEqual({ listingId: 'abc', startDate: '2026-01-01', nested: { someKey: 'value' } })
    })

    it('omits undefined params', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/listings', { page: undefined, active: true })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).not.toContain('page')
      expect(url).toContain('active=true')
    })
  })

  describe('status array param regression', () => {
    it('sends status array as repeated status[] params, never comma-joined', async () => {
      mockFetch(200, { data: [] })
      const client = makeClient()
      await client.get('/v2/reservations', { status: ['accepted', 'confirmed'] })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const parsed = new URL(url)
      expect(parsed.searchParams.getAll('status[]')).toEqual(['accepted', 'confirmed'])
      expect(url).not.toContain('accepted%2Cconfirmed')
      expect(url).not.toContain('accepted,confirmed')
    })

    it('sends single-element status array as status[]=value', async () => {
      mockFetch(200, { data: [] })
      const client = makeClient()
      await client.get('/v2/reservations', { status: ['pending'] })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const parsed = new URL(url)
      expect(parsed.searchParams.getAll('status[]')).toEqual(['pending'])
    })

    it('sends empty array as no params', async () => {
      mockFetch(200, { data: [] })
      const client = makeClient()
      await client.get('/v2/reservations', { status: [] as string[] })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).not.toContain('status')
    })

    it('sends all ReservationStatus values as separate array entries', async () => {
      mockFetch(200, { data: [] })
      const client = makeClient()
      const allStatuses = ['not_accepted', 'request', 'accepted', 'cancelled', 'checkpoint']
      await client.get('/v2/reservations', { status: allStatuses })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const parsed = new URL(url)
      expect(parsed.searchParams.getAll('status[]')).toEqual(allStatuses)
    })

    it('preserves string status as a scalar param (not array)', async () => {
      mockFetch(200, { data: [] })
      const client = makeClient()
      await client.get('/v2/reservations', { status: 'accepted' } as Record<string, string | string[]>)
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const parsed = new URL(url)
      expect(parsed.searchParams.get('status')).toBe('accepted')
      expect(url).not.toContain('status[]')
    })
  })

  describe('camelCase param key to snake_case conversion', () => {
    it('converts camelCase param keys to snake_case in URL', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/v2/reservations', { startDate: '2026-01-01', endDate: '2026-12-31' })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toContain('start_date=2026-01-01')
      expect(url).toContain('end_date=2026-12-31')
      expect(url).not.toContain('startDate')
      expect(url).not.toContain('endDate')
    })

    it('converts camelCase array param keys to snake_case', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/v2/properties', { propertyIds: ['a', 'b'] })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const parsed = new URL(url)
      expect(parsed.searchParams.getAll('property_ids[]')).toEqual(['a', 'b'])
    })

    it('leaves already snake_case keys unchanged', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/v2/reservations', { per_page: 50 } as Record<string, number>)
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toContain('per_page=50')
    })

    it('converts perPage to per_page', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/v2/reservations', { perPage: 25 })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toContain('per_page=25')
      expect(url).not.toContain('perPage')
    })
  })

  describe('HTTP methods', () => {
    beforeEach(() => {
      mockFetch(200, { ok: true })
    })

    it('GET uses correct method', async () => {
      const client = makeClient()
      await client.get('/listings')
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].method).toBe('GET')
    })

    it('POST uses correct method', async () => {
      const client = makeClient()
      await client.post('/listings', { name: 'test' })
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].method).toBe('POST')
    })

    it('PUT uses correct method', async () => {
      const client = makeClient()
      await client.put('/listings/1', { name: 'updated' })
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].method).toBe('PUT')
    })

    it('PATCH uses correct method', async () => {
      const client = makeClient()
      await client.patch('/listings/1', { name: 'patched' })
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].method).toBe('PATCH')
    })

    it('DELETE uses correct method', async () => {
      const client = makeClient()
      await client.delete('/listings/1')
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].method).toBe('DELETE')
    })
  })

  describe('JSON body serialization', () => {
    it('serializes body on POST', async () => {
      mockFetch(201, { id: 42 })
      const client = makeClient()
      const payload = { name: 'Beach House', price: 150 }
      await client.post('/listings', payload)
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].body).toBe(JSON.stringify(payload))
    })

    it('serializes body on PUT', async () => {
      mockFetch(200, { id: 1 })
      const client = makeClient()
      const payload = { name: 'Updated' }
      await client.put('/listings/1', payload)
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].body).toBe(JSON.stringify(payload))
    })

    it('serializes body on PATCH', async () => {
      mockFetch(200, { id: 1 })
      const client = makeClient()
      const payload = { active: false }
      await client.patch('/listings/1', payload)
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].body).toBe(JSON.stringify(payload))
    })

    it('sends no body on GET', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/listings')
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(fetchCall[1].body).toBeUndefined()
    })
  })

  describe('request body camelCase to snake_case conversion', () => {
    it('converts camelCase body keys to snake_case on POST', async () => {
      mockFetch(200, { ok: true })
      const client = makeClient()
      await client.post('/reservations', { firstName: 'John', lastName: 'Doe' })
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(JSON.parse(fetchCall[1].body)).toEqual({ first_name: 'John', last_name: 'Doe' })
    })

    it('converts nested camelCase body keys on PUT', async () => {
      mockFetch(200, { ok: true })
      const client = makeClient()
      await client.put('/reservations/1', { guestInfo: { firstName: 'John', phoneNumber: '555-0100' } })
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(JSON.parse(fetchCall[1].body)).toEqual({
        guest_info: { first_name: 'John', phone_number: '555-0100' },
      })
    })

    it('converts camelCase keys on PATCH', async () => {
      mockFetch(200, { ok: true })
      const client = makeClient()
      await client.patch('/reservations/1', { checkInTime: '15:00', arrivalDate: '2026-01-01' })
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body).toEqual({ check_in_time: '15:00', arrival_date: '2026-01-01' })
    })

    it('preserves string and number values while converting keys', async () => {
      mockFetch(200, { ok: true })
      const client = makeClient()
      await client.post('/listings', { nightlyRate: 150.50, maxGuests: 4, listingName: 'Beach House' })
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body['nightly_rate']).toBe(150.50)
      expect(body['max_guests']).toBe(4)
      expect(body['listing_name']).toBe('Beach House')
    })

    it('converts keys in arrays within body', async () => {
      mockFetch(200, { ok: true })
      const client = makeClient()
      await client.post('/bulk', { items: [{ arrivalDate: '2026-03-01' }, { arrivalDate: '2026-04-01' }] })
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body).toEqual({ items: [{ arrival_date: '2026-03-01' }, { arrival_date: '2026-04-01' }] })
    })

    it('converts body keys on 401 retry request too', async () => {
      let fetchCallCount = 0
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: false, status: 401,
            headers: new Headers(),
            json: async () => ({ message: 'Unauthorized' }),
          })
        }
        return Promise.resolve({
          ok: true, status: 200,
          headers: new Headers(),
          json: async () => ({ ok: true }),
        })
      }))

      const client = new HttpClient({
        baseURL: BASE_URL,
        getAuthHeader: async () => AUTH_HEADER,
        onUnauthorized: async () => {},
        retryConfig: { maxAttempts: 1 },
      })

      await client.post('/test', { guestName: 'Alice' })

      const retryCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1]
      expect(JSON.parse(retryCall[1].body)).toEqual({ guest_name: 'Alice' })
    })
  })

  describe('error handling', () => {
    it('throws NotFoundError on 404', async () => {
      mockFetch(404, { message: 'Not found' })
      const client = makeClient()
      const err = await client.get('/listings/999').catch((e) => e)
      expect(err).toBeInstanceOf(NotFoundError)
      expect(err).toBeInstanceOf(HospitableError)
      expect(err.statusCode).toBe(404)
      expect(err.message).toBe('Not found')
    })

    it('throws AuthenticationError on 401 (no onUnauthorized)', async () => {
      mockFetch(401, { message: 'Unauthorized' })
      const client = makeClient()
      const err = await client.get('/me').catch((e) => e)
      expect(err).toBeInstanceOf(AuthenticationError)
      expect(err.statusCode).toBe(401)
      expect(err.message).toBe('Unauthorized')
    })

    it('throws ValidationError with fields on 422', async () => {
      mockFetch(422, { message: 'Invalid', errors: { email: ['is required'] } })
      const client = makeClient()
      const err = await client.get('/listings').catch((e) => e)
      expect(err).toBeInstanceOf(ValidationError)
      expect(err.statusCode).toBe(422)
      expect((err as ValidationError).fields).toEqual({ email: ['is required'] })
    })

    it('normalizes snake_case error bodies — ValidationError.fields works from API-shape payloads', async () => {
      mockFetch(422, { message: 'Invalid', errors: { first_name: ['is required'] } })
      const client = makeClient()
      const err = await client.get('/listings').catch((e) => e)
      expect((err as ValidationError).fields).toEqual({ firstName: ['is required'] })
    })

    it('throws RateLimitError with retryAfter on 429', async () => {
      mockFetch(429, { message: 'Too many', retryAfter: 45 })
      const client = new HttpClient({
        baseURL: BASE_URL,
        getAuthHeader: async () => AUTH_HEADER,
        retryConfig: { maxAttempts: 1 },
      })
      const err = await client.get('/listings').catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(45)
    })

    it('maps 5xx responses to ServerError', async () => {
      mockFetch(500, { message: 'Internal server error' })
      const client = makeClient()
      const err = await client.get('/listings').catch((e) => e)
      expect(err).toBeInstanceOf(ServerError)
      expect(err.statusCode).toBe(500)
    })

    it('uses fallback HTTP message when body has no message field', async () => {
      mockFetch(503, {})
      const client = makeClient()
      const err = await client.get('/listings').catch((e) => e)
      expect(err).toBeInstanceOf(ServerError)
      expect(err.statusCode).toBe(503)
      expect(err.message).toBe('HTTP 503')
    })

    it('captures x-request-id on the typed error', async () => {
      mockFetch(422, { message: 'Validation failed' }, { 'x-request-id': 'req-abc-123' })
      const client = makeClient()
      const err = await client.get('/listings').catch((e) => e)
      expect(err).toBeInstanceOf(ValidationError)
      expect(err.requestId).toBe('req-abc-123')
    })

    it('sets requestId to undefined when x-request-id header is absent', async () => {
      mockFetch(404, { message: 'Not found' })
      const client = makeClient()
      const err = await client.get('/listings').catch((e) => e)
      expect(err.requestId).toBeUndefined()
    })

    it('handles non-JSON error body gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          headers: new Headers(),
          json: async () => {
            throw new SyntaxError('Unexpected token')
          },
        }),
      )
      const client = makeClient()
      const err = await client.get('/listings').catch((e) => e)
      expect(err).toBeInstanceOf(ServerError)
      expect(err.statusCode).toBe(502)
      expect(err.message).toBe('HTTP 502')
    })
  })

  describe('204 No Content', () => {
    it('returns undefined for 204 response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 204,
          headers: new Headers(),
          json: async () => {
            throw new Error('should not be called')
          },
        }),
      )
      const client = makeClient()
      const result = await client.delete('/listings/1')
      expect(result).toBeUndefined()
    })
  })

  describe('debug mode', () => {
    it('calls console.debug when debug is true', async () => {
      mockFetch(200, { ok: true })
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const client = makeClient(true)
      await client.get('/listings')
      expect(debugSpy).toHaveBeenCalledOnce()
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[hospitable] GET'),
      )
      debugSpy.mockRestore()
    })

    it('does not call console.debug when debug is false', async () => {
      mockFetch(200, { ok: true })
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const client = makeClient(false)
      await client.get('/listings')
      expect(debugSpy).not.toHaveBeenCalled()
      debugSpy.mockRestore()
    })

    it('logs sanitized body when debug is true and body is present', async () => {
      mockFetch(200, { ok: true })
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const client = makeClient(true)
      await client.post('/listings', { email: 'secret@test.com', name: 'test' })
      const bodyCall = debugSpy.mock.calls.find((c) => String(c[0]).includes('body:'))
      expect(bodyCall).toBeDefined()
      // email should be masked in the log
      expect(JSON.stringify(bodyCall)).toContain('***')
      debugSpy.mockRestore()
    })

    it('logs sanitized error body when debug is true and request fails', async () => {
      mockFetch(422, { message: 'invalid', email: 'user@test.com' })
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const client = makeClient(true)
      await expect(client.get('/listings')).rejects.toBeDefined()
      const errorCall = debugSpy.mock.calls.find((c) => String(c[0]).includes('error body:'))
      expect(errorCall).toBeDefined()
      debugSpy.mockRestore()
    })

    it('debug mode logs URL then body in order on POST', async () => {
      mockFetch(200, { ok: true })
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const client = makeClient(true)
      await client.post('/listings', { name: 'test' })
      expect(debugSpy).toHaveBeenCalledTimes(2)
      expect(String(debugSpy.mock.calls[0]?.[0])).toMatch(/\[hospitable\] POST/)
      expect(String(debugSpy.mock.calls[1]?.[0])).toMatch(/\[hospitable\] body:/)
      debugSpy.mockRestore()
    })
  })

  describe('401 → token refresh → retry', () => {
    it('calls onUnauthorized and retries with fresh token on 401', async () => {
      let fetchCallCount = 0
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: false, status: 401,
            headers: new Headers(),
            json: async () => ({ message: 'Unauthorized' }),
          })
        }
        return Promise.resolve({
          ok: true, status: 200,
          headers: new Headers(),
          json: async () => ({ data: 'retried' }),
        })
      }))

      const onUnauthorized = vi.fn().mockResolvedValue(undefined)
      const client = new HttpClient({
        baseURL: BASE_URL,
        getAuthHeader: async () => 'Bearer token',
        onUnauthorized,
        retryConfig: { maxAttempts: 1 },
      })

      const result = await client.get('/test')
      expect(result).toEqual({ data: 'retried' })
      expect(onUnauthorized).toHaveBeenCalledOnce()
      expect(fetchCallCount).toBe(2) // original + retry
    })

    it('transforms snake_case to camelCase on 401-retry success response', async () => {
      let fetchCallCount = 0
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        fetchCallCount++
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: false, status: 401,
            headers: new Headers(),
            json: async () => ({ message: 'Unauthorized' }),
          })
        }
        return Promise.resolve({
          ok: true, status: 200,
          headers: new Headers(),
          json: async () => ({ user_id: 'abc', created_at: '2026-01-01' }),
        })
      }))

      const onUnauthorized = vi.fn().mockResolvedValue(undefined)
      const client = new HttpClient({
        baseURL: BASE_URL,
        getAuthHeader: async () => 'Bearer token',
        onUnauthorized,
        retryConfig: { maxAttempts: 1 },
      })

      const result = await client.get<Record<string, unknown>>('/test')
      expect(result).toEqual({ userId: 'abc', createdAt: '2026-01-01' })
    })

    it('propagates error from retry response if still failing after refresh', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 401,
        headers: new Headers(),
        json: async () => ({ message: 'Still unauthorized' }),
      }))

      const onUnauthorized = vi.fn().mockResolvedValue(undefined)
      const client = new HttpClient({
        baseURL: BASE_URL,
        getAuthHeader: async () => 'Bearer token',
        onUnauthorized,
        retryConfig: { maxAttempts: 1 },
      })

      await expect(client.get('/test')).rejects.toMatchObject({ statusCode: 401 })
      expect(onUnauthorized).toHaveBeenCalledOnce()
    })

    it('throws AuthenticationError immediately when no onUnauthorized is configured', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 401,
        headers: new Headers(),
        json: async () => ({ message: 'Unauthorized' }),
      }))

      const client = new HttpClient({
        baseURL: BASE_URL,
        getAuthHeader: async () => 'Bearer token',
        retryConfig: { maxAttempts: 1 },
      })

      const err = await client.get('/test').catch((e) => e)
      expect(err).toBeInstanceOf(AuthenticationError)
      expect(err.statusCode).toBe(401)
    })
  })
})
