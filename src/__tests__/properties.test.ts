import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PropertiesResource } from '../resources/properties'
import type { HttpClient } from '../http/client'
import type { Property, PropertyImage, PropertyIcalImport, PropertyTag } from '../models/property'
import type { PaginatedResponse } from '../models/pagination'
import { ConfigurationError, NotFoundError, RateLimitError, ValidationError } from '../errors'
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

    it('deserializes include=bookings into the structured PropertyBookings shape', async () => {
      // Regression guard: as of 0.5.4, PropertyBookings is a concrete
      // interface (not `unknown`). This test verifies every sub-field
      // narrows correctly without a cast.
      const withBookings = {
        ...mockProperty,
        bookings: {
          fees: [
            {
              name: 'Cleaning Fee',
              type: 'flat',
              value: { amount: 10000, formatted: '$100.00' },
            },
          ],
          occupancyBasedRules: {
            guestsIncluded: 2,
            extraGuestFee: {
              type: 'per_night',
              value: { amount: 1000, formatted: '$10.00' },
            },
            petFee: {
              type: 'flat',
              value: { amount: 5000, formatted: '$50.00' },
            },
          },
          discounts: [],
          listingMarkups: [
            { platform: 'airbnb', type: 'percentage', markup: 10 },
            { platform: 'vrbo', type: 'percentage', markup: 15 },
          ],
          securityDeposits: [],
          securityDepositCollector: null,
          bookingPolicies: {
            cancellation: ['Flexible', 'Within 48h', 'Strict after'],
            paymentTerms: {
              status: 'full_payment',
              description: ['Full payment required at booking'],
              gracePeriod: 24,
            },
          },
          siteUrls: ['https://airbnb.com/rooms/123', 'https://vrbo.com/456'],
        },
      }
      vi.mocked(http.get).mockResolvedValue({ data: withBookings })
      const result = await resource.get('prop-1', 'bookings')
      const b = result.bookings!

      expect(b.fees[0]!.name).toBe('Cleaning Fee')
      expect(b.fees[0]!.value.amount).toBe(10000)
      expect(b.occupancyBasedRules.guestsIncluded).toBe(2)
      expect(b.occupancyBasedRules.extraGuestFee.type).toBe('per_night')
      expect(b.listingMarkups).toHaveLength(2)
      expect(b.listingMarkups[0]!.platform).toBe('airbnb')
      expect(b.bookingPolicies.cancellation).toHaveLength(3)
      expect(b.bookingPolicies.paymentTerms.gracePeriod).toBe(24)
      expect(b.siteUrls).toContain('https://airbnb.com/rooms/123')
    })

    it('deserializes icalImports when include=listings is requested', async () => {
      // Regression guard: icalImports is an UNDOCUMENTED side-effect
      // of include=listings — empirically verified. The Hospitable
      // docs don't mention this gating, but probing shows ical_imports
      // appears on the response whenever include=listings is passed
      // (directly or via a multi-include).
      // Shape: {id, url, name, host{firstName, lastName}, lastSyncAt, disconnectedAt}.
      const withImports = {
        ...mockProperty,
        icalImports: [
          {
            id: '0197b039-d99e-7120-85c4-5839eb956382',
            url: 'https://www.crewdogs.com/ical/20250511173354823.ics',
            name: 'Crewdogs Calendar',
            host: { firstName: 'Crewdogs', lastName: 'Calendar' },
            lastSyncAt: '2026-04-11T18:40:13+00:00',
            disconnectedAt: null,
          },
        ],
      }
      vi.mocked(http.get).mockResolvedValue({ data: withImports })
      const result = await resource.get('prop-1', 'listings')

      expect(result.icalImports).toBeDefined()
      expect(result.icalImports).toHaveLength(1)
      expect(result.icalImports![0]!.name).toBe('Crewdogs Calendar')
      expect(result.icalImports![0]!.url).toContain('ical/')
      expect(result.icalImports![0]!.host.firstName).toBe('Crewdogs')
      expect(result.icalImports![0]!.disconnectedAt).toBe(null)
    })

    it('icalImports is undefined when include=listings is not requested', async () => {
      // The field is gated on include=listings. Without it, the API
      // doesn't return the field at all — undefined, not empty array.
      vi.mocked(http.get).mockResolvedValue({ data: mockProperty })
      const result = await resource.get('prop-1')
      expect(result.icalImports).toBeUndefined()
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

  describe('addTags()', () => {
    it('calls POST /v2/properties/{id}/tags with tag array', async () => {
      vi.mocked(http.post).mockResolvedValue(undefined)

      await resource.addTags('prop-1', ['beach', 'pool'])

      expect(http.post).toHaveBeenCalledWith(
        '/v2/properties/prop-1/tags',
        { tags: ['beach', 'pool'] },
      )
    })

    it('throws ConfigurationError when tags array is empty', async () => {
      await expect(resource.addTags('prop-1', [])).rejects.toBeInstanceOf(ConfigurationError)
      expect(http.post).not.toHaveBeenCalled()
    })

    it('throws ConfigurationError when tags array exceeds 10 items', async () => {
      const tags = Array.from({ length: 11 }, (_, i) => `tag-${i}`)
      await expect(resource.addTags('prop-1', tags)).rejects.toBeInstanceOf(ConfigurationError)
      expect(http.post).not.toHaveBeenCalled()
    })

    it('accepts exactly 10 tags', async () => {
      vi.mocked(http.post).mockResolvedValue(undefined)
      const tags = Array.from({ length: 10 }, (_, i) => `tag-${i}`)
      await resource.addTags('prop-1', tags)
      expect(http.post).toHaveBeenCalled()
    })

    it('accepts exactly 1 tag', async () => {
      vi.mocked(http.post).mockResolvedValue(undefined)
      await resource.addTags('prop-1', ['solo'])
      expect(http.post).toHaveBeenCalled()
    })

    it('clears the cache after tagging', async () => {
      const cachedHttp = makeHttpClient()
      const cachedResource = new PropertiesResource(cachedHttp, { enabled: true, ttl: 60_000 })
      vi.mocked(cachedHttp.get).mockResolvedValue({ data: mockProperty })
      vi.mocked(cachedHttp.post).mockResolvedValue(undefined)

      await cachedResource.get('prop-1')
      await cachedResource.addTags('prop-1', ['beach'])
      await cachedResource.get('prop-1')

      expect(cachedHttp.get).toHaveBeenCalledTimes(2)
    })

    it('includes the method name in the ConfigurationError message', async () => {
      const err = (await resource.addTags('prop-1', []).catch((e) => e)) as Error
      expect(err.message).toContain('addTags')
      expect(err.message).toContain('1-10')
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.addTags('prop-1', ['beach']).catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })
  })

  describe('createQuote()', () => {
    it('calls POST /v2/properties/{id}/quote with params', async () => {
      vi.mocked(http.post).mockResolvedValue({ total: 50000 })

      const result = await resource.createQuote('prop-1', {
        checkinDate: '2026-06-01',
        checkoutDate: '2026-06-05',
        guests: { adults: 2 },
      })

      expect(http.post).toHaveBeenCalledWith(
        '/v2/properties/prop-1/quote',
        {
          checkinDate: '2026-06-01',
          checkoutDate: '2026-06-05',
          guests: { adults: 2 },
        },
      )
      expect(result).toEqual({ total: 50000 })
    })

    it('propagates ValidationError on 422', async () => {
      vi.mocked(http.post).mockRejectedValue(new ValidationError('Invalid'))
      await expect(resource.createQuote('prop-1', {
        checkinDate: '2026-06-01',
        checkoutDate: '2026-06-05',
        guests: { adults: 2 },
      })).rejects.toBeInstanceOf(ValidationError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.createQuote('prop-1', {
        checkinDate: '2026-06-01',
        checkoutDate: '2026-06-05',
        guests: { adults: 2 },
      }).catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })
  })

  describe('createIcalImport()', () => {
    const mockIcal: PropertyIcalImport = {
      id: 'ical-1',
      url: 'https://example.com/feed.ics',
      name: 'External Calendar',
      host: { firstName: 'Jane', lastName: 'Doe' },
      lastSyncAt: '2026-04-11T18:40:13+00:00',
      disconnectedAt: null,
    }

    it('calls POST /v2/properties/{id}/ical-imports and unwraps .data', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: mockIcal })

      const result = await resource.createIcalImport('prop-1', 'https://example.com/feed.ics')

      expect(http.post).toHaveBeenCalledWith(
        '/v2/properties/prop-1/ical-imports',
        { url: 'https://example.com/feed.ics' },
      )
      expect(result).toEqual(mockIcal)
    })

    it('passes optional name and host through', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: mockIcal })

      await resource.createIcalImport('prop-1', 'https://example.com/feed.ics', {
        name: 'My Calendar',
        host: { firstName: 'Jane', lastName: 'Doe' },
      })

      expect(http.post).toHaveBeenCalledWith(
        '/v2/properties/prop-1/ical-imports',
        {
          url: 'https://example.com/feed.ics',
          name: 'My Calendar',
          host: { firstName: 'Jane', lastName: 'Doe' },
        },
      )
    })

    it('propagates ValidationError on 422', async () => {
      vi.mocked(http.post).mockRejectedValue(new ValidationError('Bad URL'))
      await expect(
        resource.createIcalImport('prop-1', 'not-a-url'),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.createIcalImport('prop-1', 'https://example.com/feed.ics').catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })
  })

  describe('updateIcalImport()', () => {
    const mockIcal: PropertyIcalImport = {
      id: 'ical-1',
      url: 'https://example.com/updated.ics',
      name: 'Updated Calendar',
      host: { firstName: 'Jane', lastName: 'Doe' },
      lastSyncAt: '2026-04-11T18:40:13+00:00',
      disconnectedAt: null,
    }

    it('calls PUT /v2/properties/{id}/ical-imports/{icalUuid} and unwraps .data', async () => {
      vi.mocked(http.put).mockResolvedValue({ data: mockIcal })

      const result = await resource.updateIcalImport('prop-1', 'ical-1', {
        url: 'https://example.com/updated.ics',
      })

      expect(http.put).toHaveBeenCalledWith(
        '/v2/properties/prop-1/ical-imports/ical-1',
        { url: 'https://example.com/updated.ics' },
      )
      expect(result).toEqual(mockIcal)
    })

    it('passes resync option', async () => {
      vi.mocked(http.put).mockResolvedValue({ data: mockIcal })

      await resource.updateIcalImport('prop-1', 'ical-1', { resync: true })

      expect(http.put).toHaveBeenCalledWith(
        '/v2/properties/prop-1/ical-imports/ical-1',
        { resync: true },
      )
    })

    it('propagates NotFoundError on 404', async () => {
      vi.mocked(http.put).mockRejectedValue(new NotFoundError('Not found'))
      await expect(
        resource.updateIcalImport('prop-1', 'missing', { resync: true }),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.put).mockRejectedValue(new RateLimitError(30, 'req-1'))
      const err = (await resource.updateIcalImport('prop-1', 'ical-1', { resync: true }).catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(30)
    })

    it('propagates ValidationError on 422', async () => {
      vi.mocked(http.put).mockRejectedValue(new ValidationError('Invalid'))
      await expect(
        resource.updateIcalImport('prop-1', 'ical-1', { url: 'bad' }),
      ).rejects.toBeInstanceOf(ValidationError)
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
