import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PropertiesResource } from '../resources/properties'
import type { HttpClient } from '../http/client'
import type { Property, PropertyTag } from '../models/property'
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
  calendarRestricted: false,
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

  it('get(id) calls GET /v2/properties/{id}', async () => {
    vi.mocked(http.get).mockResolvedValue(mockProperty)
    const result = await resource.get('prop-1')
    expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1')
    expect(result).toEqual(mockProperty)
  })

  it('listTags(id) calls GET /v2/properties/{id}/tags and returns .data array', async () => {
    const tags: PropertyTag[] = [{ id: 'tag-1', name: 'Beachfront' }]
    vi.mocked(http.get).mockResolvedValue({ data: tags })
    const result = await resource.listTags('prop-1')
    expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1/tags')
    expect(result).toEqual(tags)
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
