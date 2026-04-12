import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PropertiesResource } from '../resources/properties'
import type { HttpClient } from '../http/client'
import type { Property, PropertyImage, PropertyTag } from '../models/property'
import type { PaginatedResponse } from '../models/pagination'
import { makeHttpClient } from './helpers'

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
  roomDetails: [],
  calendarRestricted: false,
  parentChild: null,
}

const mockPropertyList: PaginatedResponse<Property> = {
  data: [mockProperty],
  meta: { currentPage: 1, lastPage: 1, perPage: 10, total: 1 },
  links: { first: null, last: null, prev: null, next: null },
}

describe('PropertiesResource', () => {
  let http: HttpClient
  let resource: PropertiesResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new PropertiesResource(http)
  })

  it('list() calls GET /v2/properties with no params', async () => {
    vi.mocked(http.get).mockResolvedValue(mockPropertyList)
    const result = await resource.list()
    expect(http.get).toHaveBeenCalledWith('/v2/properties', {})
    expect(result).toEqual(mockPropertyList)
  })

  it('list({ perPage: 10 }) passes perPage param', async () => {
    vi.mocked(http.get).mockResolvedValue(mockPropertyList)
    await resource.list({ perPage: 10 })
    expect(http.get).toHaveBeenCalledWith('/v2/properties', { perPage: 10 })
  })

  it('get(id) calls GET /v2/properties/{id} and unwraps the .data envelope', async () => {
    // The single-property endpoint wraps in { data: Property } — see
    // resource JSDoc. This test asserts the unwrap.
    vi.mocked(http.get).mockResolvedValue({ data: mockProperty })
    const result = await resource.get('prop-1')
    expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1', undefined)
    expect(result).toEqual(mockProperty)
  })

  it('get(id, include) forwards include as a query param', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: mockProperty })
    await resource.get('prop-1', 'user,listings,details,bookings')
    expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1', {
      include: 'user,listings,details,bookings',
    })
  })

  it('list({ include }) forwards include as a query param', async () => {
    vi.mocked(http.get).mockResolvedValue(mockPropertyList)
    await resource.list({ include: 'user,listings' })
    expect(http.get).toHaveBeenCalledWith('/v2/properties', {
      include: 'user,listings',
    })
  })

  it('get() caches separately when include differs', async () => {
    // Regression guard: the cache key must include `include` so that
    // `get(id)` and `get(id, 'user')` don't collide. Without this, the
    // second call would return the first (unincluded) cached result.
    const http2 = makeHttpClient()
    const cachedResource = new PropertiesResource(http2, {
      enabled: true,
      ttl: 60_000,
    })
    vi.mocked(http2.get).mockResolvedValue({ data: mockProperty })

    await cachedResource.get('prop-1')
    await cachedResource.get('prop-1', 'user')

    expect(http2.get).toHaveBeenCalledTimes(2)
  })

  it('listTags(id) calls GET /v2/properties/{id}/tags and returns .data array', async () => {
    const tags: PropertyTag[] = [{ id: 'tag-1', name: 'Beachfront' }]
    vi.mocked(http.get).mockResolvedValue({ data: tags })
    const result = await resource.listTags('prop-1')
    expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1/tags')
    expect(result).toEqual(tags)
  })

  it('getImages(id) calls GET /v2/properties/{id}/images and returns the .data array', async () => {
    const images: PropertyImage[] = [
      {
        url: 'https://example.com/1.jpg',
        thumbnailUrl: 'https://example.com/1-thumb.jpg',
        caption: 'Living room',
        order: 0,
        lastUpdatedAt: '2026-01-01T00:00:00Z',
      },
      {
        url: 'https://example.com/2.jpg',
        thumbnailUrl: 'https://example.com/2-thumb.jpg',
        caption: '',
        order: 1,
        lastUpdatedAt: '2026-01-02T00:00:00Z',
      },
    ]
    vi.mocked(http.get).mockResolvedValue({ data: images })

    const result = await resource.getImages('prop-1')

    expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1/images')
    expect(result).toEqual(images)
    expect(result[0]!.order).toBe(0)
    expect(result[1]!.caption).toBe('')
  })

  it('search() passes startDate, endDate, and adults as-is', async () => {
    vi.mocked(http.get).mockResolvedValue(mockPropertyList)
    await resource.search({
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      adults: 2,
    })
    expect(http.get).toHaveBeenCalledWith(
      '/v2/properties/search',
      expect.objectContaining({
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        adults: 2,
      }),
    )
  })

  it('search() forwards optional party-size fields', async () => {
    vi.mocked(http.get).mockResolvedValue(mockPropertyList)
    await resource.search({
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      adults: 2,
      children: 1,
      infants: 0,
      pets: 1,
    })
    expect(http.get).toHaveBeenCalledWith(
      '/v2/properties/search',
      expect.objectContaining({
        children: 1,
        infants: 0,
        pets: 1,
      }),
    )
  })

  describe('include shapes', () => {
    it('deserializes include=user into a nested PropertyUser object', async () => {
      const withUser = {
        ...mockProperty,
        user: {
          id: 'user-1',
          email: 'host@example.com',
          name: 'Host Name',
          profilePicture: 'https://example.com/pic.jpg',
        },
      }
      vi.mocked(http.get).mockResolvedValue({ data: withUser })
      const result = await resource.get('prop-1', 'user')
      expect(result.user).toBeDefined()
      expect(result.user!.email).toBe('host@example.com')
      expect(result.user!.name).toBe('Host Name')
    })

    it('deserializes include=listings into a PropertyListing array', async () => {
      const withListings = {
        ...mockProperty,
        listings: [
          {
            platform: 'airbnb',
            platformId: '1146437593562579512',
            platformUserId: '444499287',
            platformPicture: 'https://a0.muscache.com/profile.jpg',
            platformName: 'Hummingbird Cottages',
            platformEmail: null,
            coHosts: [
              { userId: '51018147', name: 'Nancy', channelName: 'Nancy' },
            ],
          },
        ],
      }
      vi.mocked(http.get).mockResolvedValue({ data: withListings })
      const result = await resource.get('prop-1', 'listings')
      expect(result.listings).toHaveLength(1)
      expect(result.listings![0]!.platform).toBe('airbnb')
      expect(result.listings![0]!.coHosts[0]!.name).toBe('Nancy')
    })

    it('deserializes include=details with wifi + house manual', async () => {
      const withDetails = {
        ...mockProperty,
        details: {
          additionalRules: 'Quiet hours 10pm-7am',
          gettingAround: '5 min walk to downtown',
          guestAccess: 'Keypad lock',
          houseManual: null,
          neighborhoodDescription: 'Quiet residential area',
          otherDetails: null,
          spaceOverview: 'Cozy cottage',
          wifiName: 'Hummingbird_5G',
          wifiPassword: 'supersecret123',
        },
      }
      vi.mocked(http.get).mockResolvedValue({ data: withDetails })
      const result = await resource.get('prop-1', 'details')
      expect(result.details).toBeDefined()
      expect(result.details!.wifiName).toBe('Hummingbird_5G')
      // Raw value preserved — sanitization happens at log/error time, not
      // on the API response object itself.
      expect(result.details!.wifiPassword).toBe('supersecret123')
    })

    it('deserializes include=bookings as opaque (unknown)', async () => {
      const withBookings = {
        ...mockProperty,
        bookings: {
          bookingPolicies: { minStay: 2 },
          fees: [],
          discounts: [],
        },
      }
      vi.mocked(http.get).mockResolvedValue({ data: withBookings })
      const result = await resource.get('prop-1', 'bookings')
      // bookings is typed as unknown — narrow at the call site
      expect(result.bookings).toBeDefined()
      const b = result.bookings as { fees: unknown[]; discounts: unknown[] }
      expect(b.fees).toEqual([])
      expect(b.discounts).toEqual([])
    })

    it('handles the combined include=user,listings,details,bookings', async () => {
      const combined = {
        ...mockProperty,
        user: { id: 'u1', email: 'a@b.com', name: 'A', profilePicture: null },
        listings: [],
        details: {
          additionalRules: null,
          gettingAround: null,
          guestAccess: null,
          houseManual: null,
          neighborhoodDescription: null,
          otherDetails: null,
          spaceOverview: null,
          wifiName: null,
          wifiPassword: null,
        },
        bookings: {},
      }
      vi.mocked(http.get).mockResolvedValue({ data: combined })
      const result = await resource.get('prop-1', 'user,listings,details,bookings')
      expect(result.user).toBeDefined()
      expect(result.listings).toBeDefined()
      expect(result.details).toBeDefined()
      expect(result.bookings).toBeDefined()
    })
  })

  it('iter() yields items across 2 pages', async () => {
    const page1: PaginatedResponse<Property> = {
      data: [{ ...mockProperty, id: 'prop-1' }],
      meta: { currentPage: 1, lastPage: 2, perPage: 1, total: 2 },
      links: { first: null, last: null, prev: null, next: 'next' },
    }
    const page2: PaginatedResponse<Property> = {
      data: [{ ...mockProperty, id: 'prop-2' }],
      meta: { currentPage: 2, lastPage: 2, perPage: 1, total: 2 },
      links: { first: null, last: null, prev: null, next: null },
    }
    vi.mocked(http.get).mockResolvedValueOnce(page1).mockResolvedValueOnce(page2)

    const results: Property[] = []
    for await (const item of resource.iter()) {
      results.push(item)
    }

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('prop-1')
    expect(results[1].id).toBe('prop-2')
    expect(http.get).toHaveBeenCalledTimes(2)
    expect(http.get).toHaveBeenNthCalledWith(1, '/v2/properties', { page: 1 })
    expect(http.get).toHaveBeenNthCalledWith(2, '/v2/properties', { page: 2 })
  })
})
