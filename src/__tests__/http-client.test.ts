import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient, HttpError } from '../http/client'
import { VERSION } from '../index'

const BASE_URL = 'https://api.hospitable.com'
const AUTH_HEADER = 'Bearer test-token'

function makeClient(debug = false) {
  return new HttpClient({
    baseURL: BASE_URL,
    getAuthHeader: async () => AUTH_HEADER,
    debug,
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

    it('serializes array params as repeated keys', async () => {
      mockFetch(200, [])
      const client = makeClient()
      await client.get('/listings', { ids: ['a', 'b', 'c'] })
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      const parsed = new URL(url)
      expect(parsed.searchParams.getAll('ids')).toEqual(['a', 'b', 'c'])
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

  describe('error handling', () => {
    it('throws HttpError with correct statusCode on 404', async () => {
      mockFetch(404, { message: 'Not found' })
      const client = makeClient()
      await expect(client.get('/listings/999')).rejects.toMatchObject({
        name: 'HttpError',
        statusCode: 404,
        message: 'Not found',
      })
    })

    it('throws HttpError with correct statusCode on 401', async () => {
      mockFetch(401, { message: 'Unauthorized' })
      const client = makeClient()
      await expect(client.get('/me')).rejects.toMatchObject({
        name: 'HttpError',
        statusCode: 401,
        message: 'Unauthorized',
      })
    })

    it('throws HttpError with correct statusCode on 500', async () => {
      mockFetch(500, { message: 'Internal server error' })
      const client = makeClient()
      await expect(client.get('/listings')).rejects.toMatchObject({
        name: 'HttpError',
        statusCode: 500,
      })
    })

    it('uses fallback message when body has no message field', async () => {
      mockFetch(503, {})
      const client = makeClient()
      await expect(client.get('/listings')).rejects.toMatchObject({
        statusCode: 503,
        message: 'HTTP 503',
      })
    })

    it('captures x-request-id in HttpError.requestId', async () => {
      mockFetch(422, { message: 'Validation failed' }, { 'x-request-id': 'req-abc-123' })
      const client = makeClient()
      await expect(client.get('/listings')).rejects.toMatchObject({
        requestId: 'req-abc-123',
      })
    })

    it('sets requestId to undefined when x-request-id header is absent', async () => {
      mockFetch(400, { message: 'Bad request' })
      const client = makeClient()
      let caught: HttpError | undefined
      try {
        await client.get('/listings')
      } catch (e) {
        caught = e as HttpError
      }
      expect(caught?.requestId).toBeUndefined()
    })

    it('includes error body in HttpError.body', async () => {
      const errorBody = { message: 'Unprocessable', errors: { name: ['is required'] } }
      mockFetch(422, errorBody)
      const client = makeClient()
      let caught: HttpError | undefined
      try {
        await client.get('/listings')
      } catch (e) {
        caught = e as HttpError
      }
      expect(caught?.body).toEqual(errorBody)
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
      await expect(client.get('/listings')).rejects.toMatchObject({
        statusCode: 502,
        message: 'HTTP 502',
      })
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
  })
})
