import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PropertiesResource } from '../resources/properties'
import type { HttpClient } from '../http/client'
import type { Property, PropertyTag } from '../models/property'
import type { CalendarDay, CalendarUpdate } from '../models/calendar'
import type { PaginatedResponse } from '../models/pagination'

function makeHttpClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  } as unknown as HttpClient
}

const mockProperty: Property = {
  id: 'prop-1',
  name: 'Beach House',
  platform: 'airbnb',
  platformId: 'airbnb-123',
  active: true,
  timezone: 'America/New_York',
  currency: 'USD',
  address: {
    street: '123 Ocean Ave',
    city: 'Miami',
    state: 'FL',
    country: 'US',
    zipCode: '33101',
  },
  tags: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockPropertyList: PaginatedResponse<Property> = {
  data: [mockProperty],
  meta: { nextCursor: null, total: 1, perPage: 10 },
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

  it('getCalendar(id, start, end) calls GET with startDate/endDate params', async () => {
    const calendarResponse: PaginatedResponse<CalendarDay> = {
      data: [
        {
          date: '2024-06-01',
          available: true,
          price: { amount: 150, currency: 'USD' },
          minStay: 2,
          maxStay: null,
          notes: null,
          blockedReason: null,
        },
      ],
      meta: { nextCursor: null, total: 1, perPage: 30 },
    }
    vi.mocked(http.get).mockResolvedValue(calendarResponse)
    const result = await resource.getCalendar('prop-1', '2024-06-01', '2024-06-30')
    expect(http.get).toHaveBeenCalledWith('/v2/properties/prop-1/calendar', {
      startDate: '2024-06-01',
      endDate: '2024-06-30',
    })
    expect(result).toEqual(calendarResponse)
  })

  it('updateCalendar(id, updates) calls PUT with { data: updates } body', async () => {
    vi.mocked(http.put).mockResolvedValue(undefined)
    const updates: CalendarUpdate[] = [{ date: '2024-06-01', available: false }]
    await resource.updateCalendar('prop-1', updates)
    expect(http.put).toHaveBeenCalledWith('/v2/properties/prop-1/calendar', { data: updates })
  })

  it('iter() yields items across 2 pages', async () => {
    const page1: PaginatedResponse<Property> = {
      data: [{ ...mockProperty, id: 'prop-1' }],
      meta: { nextCursor: 'cursor-abc', total: 2, perPage: 1 },
    }
    const page2: PaginatedResponse<Property> = {
      data: [{ ...mockProperty, id: 'prop-2' }],
      meta: { nextCursor: null, total: 2, perPage: 1 },
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
    expect(http.get).toHaveBeenNthCalledWith(1, '/v2/properties', { cursor: undefined })
    expect(http.get).toHaveBeenNthCalledWith(2, '/v2/properties', { cursor: 'cursor-abc' })
  })
})
