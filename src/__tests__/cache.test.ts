import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryCache, cacheKey } from '../utils/cache'
import { PropertiesResource } from '../resources/properties'
import { ReservationsResource } from '../resources/reservations'
import type { Property, PropertyTag } from '../models/property'
import type { Reservation } from '../models/reservation'
import type { PaginatedResponse } from '../models/pagination'
import { makeHttpClient } from './helpers'

describe('MemoryCache', () => {
  afterEach(() => vi.useRealTimers())

  it('stores and retrieves values', () => {
    const cache = new MemoryCache({ ttl: 10_000 })
    cache.set('k1', { id: 1 })
    expect(cache.get('k1')).toEqual({ id: 1 })
  })

  it('returns undefined for missing keys', () => {
    const cache = new MemoryCache({ ttl: 10_000 })
    expect(cache.get('missing')).toBeUndefined()
  })

  it('expires entries after TTL', () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({ ttl: 100 })
    cache.set('k1', 'val')
    expect(cache.get('k1')).toBe('val')
    vi.advanceTimersByTime(101)
    expect(cache.get('k1')).toBeUndefined()
  })

  it('evicts LRU entry when maxSize reached', () => {
    const cache = new MemoryCache({ ttl: 60_000, maxSize: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  it('promotes accessed entry so it survives eviction', () => {
    const cache = new MemoryCache({ ttl: 60_000, maxSize: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
  })

  it('sweeps expired entries before evicting live ones', () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({ ttl: 100, maxSize: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    vi.advanceTimersByTime(101)
    cache.set('c', 3)
    cache.set('d', 4)
    expect(cache.get('c')).toBe(3)
    expect(cache.get('d')).toBe(4)
  })

  it('maxSize: 1 evicts previous entry', () => {
    const cache = new MemoryCache({ ttl: 60_000, maxSize: 1 })
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
  })

  it('clear() removes all entries', () => {
    const cache = new MemoryCache({ ttl: 60_000 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('delete() removes a specific entry', () => {
    const cache = new MemoryCache({ ttl: 60_000 })
    cache.set('a', 1)
    cache.delete('a')
    expect(cache.get('a')).toBeUndefined()
  })

  it('has() returns true for existing, false for missing/expired', () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({ ttl: 100 })
    cache.set('k', 'v')
    expect(cache.has('k')).toBe(true)
    expect(cache.has('other')).toBe(false)
    vi.advanceTimersByTime(101)
    expect(cache.has('k')).toBe(false)
  })

  it('size includes expired entries until evicted', () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({ ttl: 100 })
    cache.set('a', 1)
    vi.advanceTimersByTime(101)
    expect(cache.size).toBe(1)
    cache.get('a')
    expect(cache.size).toBe(0)
  })
})

describe('cacheKey', () => {
  it('returns prefix alone when no params', () => {
    expect(cacheKey('test')).toBe('test')
    expect(cacheKey('test', {})).toBe('test')
  })

  it('sorts params deterministically', () => {
    const a = cacheKey('list', { z: 1, a: 2 })
    const b = cacheKey('list', { a: 2, z: 1 })
    expect(a).toBe(b)
  })

  it('omits undefined values', () => {
    const a = cacheKey('list', { page: 1, extra: undefined })
    const b = cacheKey('list', { page: 1 })
    expect(a).toBe(b)
  })

  it('distinguishes array vs string values', () => {
    const a = cacheKey('list', { status: ['a', 'b'] })
    const b = cacheKey('list', { status: 'a,b' })
    expect(a).not.toBe(b)
  })
})

const mockProperty: Property = {
  id: 'prop-1',
  name: 'Beach House',
  publicName: 'Beach House Public',
  picture: null,
  listed: true,
  timezone: 'America/New_York',
  currency: 'USD',
  address: {
    number: null,
    street: '123 Ocean Ave',
    city: 'Miami',
    state: 'FL',
    postcode: '33101',
    country: 'US',
    countryName: 'United States',
    coordinates: { latitude: '25.7617', longitude: '-80.1918' },
    display: '123 Ocean Ave, Miami, FL 33101',
  },
  summary: null,
  description: null,
  checkin: '15:00',
  checkout: '11:00',
  amenities: [],
  capacity: { max: 4, bedrooms: 2, beds: 2, bathrooms: 1 },
  propertyType: 'house',
  roomType: 'entire_home',
  tags: [],
  houseRules: { petsAllowed: false, smokingAllowed: false, eventsAllowed: false },
  calendarRestricted: false,
}

function makePropertyList(data: Property[] = [mockProperty]): PaginatedResponse<Property> {
  return {
    data,
    meta: { currentPage: 1, lastPage: 1, perPage: 10, total: data.length },
    links: { first: null, last: null, prev: null, next: null },
  }
}

describe('PropertiesResource caching', () => {
  afterEach(() => vi.useRealTimers())

  it('returns cached result on second call with same params', async () => {
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true, ttl: 60_000 })
    vi.mocked(http.get).mockResolvedValue(makePropertyList())

    const r1 = await resource.list()
    const r2 = await resource.list()

    expect(r1).toEqual(r2)
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('does not cache when disabled (default)', async () => {
    const http = makeHttpClient()
    const resource = new PropertiesResource(http)
    vi.mocked(http.get).mockResolvedValue(makePropertyList())

    await resource.list()
    await resource.list()

    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('caches get() by id', async () => {
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true, ttl: 60_000 })
    vi.mocked(http.get).mockResolvedValue(mockProperty)

    await resource.get('prop-1')
    await resource.get('prop-1')

    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('different params produce separate cache entries', async () => {
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true, ttl: 60_000 })
    vi.mocked(http.get).mockResolvedValue(makePropertyList())

    await resource.list({ page: 1 })
    await resource.list({ page: 2 })

    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('cache expires after TTL', async () => {
    vi.useFakeTimers()
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true, ttl: 100 })
    vi.mocked(http.get).mockResolvedValue(mockProperty)

    await resource.get('prop-1')
    vi.advanceTimersByTime(101)
    await resource.get('prop-1')

    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('clearCache() forces fresh fetch', async () => {
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true, ttl: 60_000 })
    vi.mocked(http.get).mockResolvedValue(mockProperty)

    await resource.get('prop-1')
    resource.clearCache()
    await resource.get('prop-1')

    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('defaults to 24h TTL for properties', async () => {
    vi.useFakeTimers()
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true })
    vi.mocked(http.get).mockResolvedValue(mockProperty)

    await resource.get('prop-1')
    vi.advanceTimersByTime(86_399_999)
    await resource.get('prop-1')
    expect(http.get).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2)
    await resource.get('prop-1')
    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('caches listTags() by property id', async () => {
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true, ttl: 60_000 })
    const tags: PropertyTag[] = [{ id: 'tag-1', name: 'Beachfront' }]
    vi.mocked(http.get).mockResolvedValue({ data: tags })

    const r1 = await resource.listTags('prop-1')
    const r2 = await resource.listTags('prop-1')

    expect(r1).toEqual(r2)
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('listTags() uses separate cache entries per property id', async () => {
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true, ttl: 60_000 })
    vi.mocked(http.get).mockResolvedValue({ data: [] })

    await resource.listTags('prop-1')
    await resource.listTags('prop-2')

    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('iter() bypasses cache and always hits network', async () => {
    const http = makeHttpClient()
    const resource = new PropertiesResource(http, { enabled: true, ttl: 60_000 })
    vi.mocked(http.get).mockResolvedValue(makePropertyList())

    await resource.list()
    expect(http.get).toHaveBeenCalledTimes(1)

    const items: Property[] = []
    for await (const item of resource.iter()) {
      items.push(item)
    }
    expect(http.get).toHaveBeenCalledTimes(2)
  })
})

describe('ReservationsResource caching', () => {
  afterEach(() => vi.useRealTimers())

  it('caches list() results when enabled', async () => {
    const http = makeHttpClient()
    const resource = new ReservationsResource(http, { enabled: true, ttl: 30_000 })
    const list = {
      data: [],
      meta: { currentPage: 1, lastPage: 1, perPage: 20, total: 0 },
      links: { first: null, last: null, prev: null, next: null },
    }
    vi.mocked(http.get).mockResolvedValue(list)

    await resource.list({ status: 'accepted' })
    await resource.list({ status: 'accepted' })

    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('normalizes status array to string for cache key consistency', async () => {
    const http = makeHttpClient()
    const resource = new ReservationsResource(http, { enabled: true, ttl: 30_000 })
    const list = {
      data: [],
      meta: { currentPage: 1, lastPage: 1, perPage: 20, total: 0 },
      links: { first: null, last: null, prev: null, next: null },
    }
    vi.mocked(http.get).mockResolvedValue(list)

    await resource.list({ status: ['accepted'] })
    await resource.list({ status: 'accepted' })

    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('defaults to 60s TTL for reservations', async () => {
    vi.useFakeTimers()
    const http = makeHttpClient()
    const resource = new ReservationsResource(http, { enabled: true })
    const list = {
      data: [],
      meta: { currentPage: 1, lastPage: 1, perPage: 20, total: 0 },
      links: { first: null, last: null, prev: null, next: null },
    }
    vi.mocked(http.get).mockResolvedValue(list)

    await resource.list()
    vi.advanceTimersByTime(59_999)
    await resource.list()
    expect(http.get).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2)
    await resource.list()
    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('iter() bypasses cache and always hits network', async () => {
    const http = makeHttpClient()
    const resource = new ReservationsResource(http, { enabled: true, ttl: 60_000 })
    const list = {
      data: [{ id: 'r1' }],
      meta: { currentPage: 1, lastPage: 1, perPage: 20, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    }
    vi.mocked(http.get).mockResolvedValue(list)

    await resource.list()
    expect(http.get).toHaveBeenCalledTimes(1)

    const items: Reservation[] = []
    for await (const item of resource.iter()) {
      items.push(item)
    }
    expect(http.get).toHaveBeenCalledTimes(2)
  })
})
