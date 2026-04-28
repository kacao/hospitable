import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InquiriesResource } from '../resources/inquiries'
import { normalizeInquiry } from '../models/inquiry'
import type { HttpClient } from '../http/client'
import type { Inquiry, InquiryList } from '../models/inquiry'
import type { Property } from '../models/property'
import { NotFoundError, RateLimitError } from '../errors'
import { makeHttpClient } from './helpers'

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    name: 'Relaxing Villa',
    publicName: 'Relaxing Villa',
    picture: null,
    address: {
      number: '32',
      street: 'Senefelderplatz',
      city: 'Berlin',
      state: 'BE',
      postcode: '10405',
      country: 'DE',
      countryName: 'Germany',
      coordinates: { latitude: '50.85', longitude: '4.36' },
      display: '32 Senefelderplatz, 10405 Berlin, DE',
    },
    timezone: '+0200',
    listed: true,
    currency: 'EUR',
    summary: null,
    description: null,
    checkin: '15:00',
    checkout: '11:00',
    amenities: [],
    capacity: { max: 2, bedrooms: 1, beds: 1, bathrooms: 1 },
    propertyType: 'apartment',
    roomType: 'entire_home',
    tags: [],
    houseRules: { petsAllowed: false, smokingAllowed: false, eventsAllowed: false },
    calendarRestricted: false,
    ...overrides,
  }
}

function makeInquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: '6f58fd0a-a9cb-3746-9219-384a156ff7bb',
    platform: 'homeaway',
    inquiryDate: '2026-01-01T12:00:00Z',
    arrivalDate: '2026-01-03T00:00:00-05:00',
    departureDate: '2026-01-05T00:00:00-05:00',
    guests: {
      total: 2,
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      petCount: 0,
    },
    guest: {
      firstName: 'Beulah',
      lastName: 'Hane',
    },
    ...overrides,
  }
}

function makeList(data: Inquiry[], currentPage = 1, lastPage = 1): InquiryList {
  return {
    data,
    meta: { currentPage, lastPage, perPage: 10, total: data.length },
    links: {
      first: null,
      last: null,
      prev: null,
      next: currentPage < lastPage ? 'next' : null,
    },
  }
}

describe('normalizeInquiry()', () => {
  it('should alias `properties` to `property` on the same object identity', () => {
    const property = makeProperty()
    const inquiry = makeInquiry({ properties: property })

    const result = normalizeInquiry(inquiry)

    expect(result).toBe(inquiry)
    expect(result.property).toBe(property)
    expect(result.properties).toBe(property)
  })

  it('should be a no-op when `properties` is undefined', () => {
    const inquiry = makeInquiry()

    const result = normalizeInquiry(inquiry)

    expect(result).toBe(inquiry)
    expect(result.property).toBeUndefined()
    expect(result.properties).toBeUndefined()
  })

  it('should not overwrite an existing `property` field', () => {
    const existingProperty = makeProperty({ id: 'existing' })
    const newProperty = makeProperty({ id: 'incoming' })
    const inquiry = makeInquiry({
      properties: newProperty,
      property: existingProperty,
    })

    const result = normalizeInquiry(inquiry)

    expect(result.property).toBe(existingProperty)
    expect(result.property?.id).toBe('existing')
  })
})

describe('InquiriesResource', () => {
  let http: HttpClient
  let resource: InquiriesResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new InquiriesResource(http)
  })

  describe('list()', () => {
    it('should call GET /v2/inquiries with required properties param', async () => {
      vi.mocked(http.get).mockResolvedValue(makeList([]))

      await resource.list({ properties: ['prop-1', 'prop-2'] })

      expect(http.get).toHaveBeenCalledWith('/v2/inquiries', {
        page: undefined,
        properties: ['prop-1', 'prop-2'],
        include: undefined,
        lastMessageAt: undefined,
        perPage: undefined,
      })
    })

    it('should pass all list params through normalization', async () => {
      vi.mocked(http.get).mockResolvedValue(makeList([]))

      await resource.list({
        properties: ['prop-1'],
        include: 'guest,properties',
        lastMessageAt: '2026-01-01T00:00:00Z',
        page: 2,
        perPage: 50,
      })

      expect(http.get).toHaveBeenCalledWith('/v2/inquiries', {
        properties: ['prop-1'],
        include: 'guest,properties',
        lastMessageAt: '2026-01-01T00:00:00Z',
        page: 2,
        perPage: 50,
      })
    })

    it('should normalize each inquiry in the response (aliases properties → property)', async () => {
      const property = makeProperty()
      const inquiry = makeInquiry({ properties: property })
      vi.mocked(http.get).mockResolvedValue(makeList([inquiry]))

      const result = await resource.list({ properties: ['prop-1'] })

      expect(result.data[0]?.property).toBe(property)
      expect(result.data[0]?.properties).toBe(property)
    })

    it('should not mutate the original params object', async () => {
      vi.mocked(http.get).mockResolvedValue(makeList([]))
      const params = { properties: ['prop-1'], perPage: 50 }

      await resource.list(params)

      expect(params.properties).toEqual(['prop-1'])
      expect(params.perPage).toBe(50)
    })

    it('bubbles up NotFoundError on 404', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Not Found', 'req-123'))

      await expect(resource.list({ properties: ['prop-1'] })).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(60, 'req-rl'))

      const err = await resource.list({ properties: ['prop-1'] }).catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.statusCode).toBe(429)
      expect((err as RateLimitError).retryAfter).toBe(60)
    })
  })

  describe('get()', () => {
    it('should call GET /v2/inquiries/{uuid} without include when not provided', async () => {
      const inquiry = makeInquiry()
      vi.mocked(http.get).mockResolvedValue({ data: inquiry })

      const result = await resource.get('6f58fd0a-a9cb-3746-9219-384a156ff7bb')

      expect(http.get).toHaveBeenCalledWith(
        '/v2/inquiries/6f58fd0a-a9cb-3746-9219-384a156ff7bb',
        undefined,
      )
      expect(result).toEqual(inquiry)
    })

    it('should pass include param when provided', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: makeInquiry() })

      await resource.get('uuid-1', 'guest,properties,messages')

      expect(http.get).toHaveBeenCalledWith('/v2/inquiries/uuid-1', {
        include: 'guest,properties,messages',
      })
    })

    it('should normalize the fetched inquiry (aliases properties → property)', async () => {
      const property = makeProperty()
      const inquiry = makeInquiry({ properties: property })
      vi.mocked(http.get).mockResolvedValue({ data: inquiry })

      const result = await resource.get('uuid-1', 'properties')

      expect(result.property).toBe(property)
      expect(result.properties).toBe(property)
    })

    // Regression for the silent envelope-drift bug where `get()` typed the
    // response as bare `Inquiry` and returned the `{ data: ... }` wrapper
    // as if it were the resource — leaving `result.id` undefined and
    // breaking downstream consumers that read it. See GH#57.
    it('unwraps the { data } envelope so the resource is returned at the top level', async () => {
      const inquiry = makeInquiry({ id: 'inq-99' })
      vi.mocked(http.get).mockResolvedValue({ data: inquiry })

      const result = await resource.get('inq-99')

      expect(result.id).toBe('inq-99')
      expect((result as unknown as { data?: unknown }).data).toBeUndefined()
    })

    it('throws NotFoundError on 404', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Not Found'))

      await expect(resource.get('missing-uuid')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(45, 'req-rl'))

      const err = await resource.get('uuid-1').catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.statusCode).toBe(429)
      expect((err as RateLimitError).retryAfter).toBe(45)
    })
  })

  describe('iter()', () => {
    it('should yield items across 2 pages and stop when lastPage reached', async () => {
      const i1 = makeInquiry({ id: 'inq-1' })
      const i2 = makeInquiry({ id: 'inq-2' })
      const i3 = makeInquiry({ id: 'inq-3' })

      vi.mocked(http.get)
        .mockResolvedValueOnce(makeList([i1, i2], 1, 2))
        .mockResolvedValueOnce(makeList([i3], 2, 2))

      const items: Inquiry[] = []
      for await (const item of resource.iter({ properties: ['prop-1'] })) {
        items.push(item)
      }

      expect(items.map(i => i.id)).toEqual(['inq-1', 'inq-2', 'inq-3'])
      expect(http.get).toHaveBeenCalledTimes(2)
    })

    it('should pass page=2 on second page request', async () => {
      vi.mocked(http.get)
        .mockResolvedValueOnce(makeList([makeInquiry()], 1, 2))
        .mockResolvedValueOnce(makeList([], 2, 2))

      const items: Inquiry[] = []
      for await (const item of resource.iter({ properties: ['prop-1'] })) {
        items.push(item)
      }

      const secondCall = vi.mocked(http.get).mock.calls[1]!
      const params = secondCall[1] as Record<string, unknown>
      expect(params['page']).toBe(2)
      expect(params['properties']).toEqual(['prop-1'])
    })
  })

  describe('caching', () => {
    it('should cache list results when cache is enabled', async () => {
      const cachedResource = new InquiriesResource(http, { enabled: true })
      vi.mocked(http.get).mockResolvedValue(makeList([makeInquiry()]))

      await cachedResource.list({ properties: ['prop-1'] })
      await cachedResource.list({ properties: ['prop-1'] })

      expect(http.get).toHaveBeenCalledTimes(1)
    })

    it('should cache get results when cache is enabled', async () => {
      const cachedResource = new InquiriesResource(http, { enabled: true })
      vi.mocked(http.get).mockResolvedValue({ data: makeInquiry() })

      await cachedResource.get('uuid-1')
      await cachedResource.get('uuid-1')

      expect(http.get).toHaveBeenCalledTimes(1)
    })

    it('should bypass cache after clearCache()', async () => {
      const cachedResource = new InquiriesResource(http, { enabled: true })
      vi.mocked(http.get).mockResolvedValue(makeList([]))

      await cachedResource.list({ properties: ['prop-1'] })
      cachedResource.clearCache()
      await cachedResource.list({ properties: ['prop-1'] })

      expect(http.get).toHaveBeenCalledTimes(2)
    })
  })
})

