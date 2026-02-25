import { describe, it, expect, vi, afterEach } from 'vitest'
import { HospitableClient } from '../client'
import { PropertiesResource } from '../resources/properties'
import { ReservationsResource } from '../resources/reservations'

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
})
