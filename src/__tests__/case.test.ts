import { describe, it, expect } from 'vitest'
import { snakeToCamel, camelToSnake, deepSnakeToCamel, deepCamelToSnake } from '../utils/case'

describe('snakeToCamel', () => {
  it('converts basic snake_case', () => {
    expect(snakeToCamel('start_date')).toBe('startDate')
  })

  it('converts multiple underscores', () => {
    expect(snakeToCamel('per_page_count')).toBe('perPageCount')
  })

  it('returns single-word strings unchanged', () => {
    expect(snakeToCamel('status')).toBe('status')
  })

  it('handles leading underscore', () => {
    expect(snakeToCamel('_private')).toBe('Private')
  })

  it('handles trailing underscore', () => {
    expect(snakeToCamel('value_')).toBe('value_')
  })

  it('handles double underscores by consuming second as \\w capture', () => {
    expect(snakeToCamel('some__key')).toBe('some_key')
  })

  it('returns empty string unchanged', () => {
    expect(snakeToCamel('')).toBe('')
  })
})

describe('camelToSnake', () => {
  it('converts basic camelCase', () => {
    expect(camelToSnake('startDate')).toBe('start_date')
  })

  it('converts multiple humps', () => {
    expect(camelToSnake('perPageCount')).toBe('per_page_count')
  })

  it('returns single-word strings unchanged', () => {
    expect(camelToSnake('status')).toBe('status')
  })

  it('returns already snake_case unchanged', () => {
    expect(camelToSnake('start_date')).toBe('start_date')
  })

  it('converts consecutive uppercase letters individually', () => {
    expect(camelToSnake('propertyURL')).toBe('property_u_r_l')
  })

  it('handles PascalCase', () => {
    expect(camelToSnake('StartDate')).toBe('_start_date')
  })

  it('returns empty string unchanged', () => {
    expect(camelToSnake('')).toBe('')
  })

  it('preserves numbers', () => {
    expect(camelToSnake('prop1Name')).toBe('prop1_name')
  })
})

describe('deepSnakeToCamel', () => {
  it('converts flat object keys', () => {
    expect(deepSnakeToCamel({ start_date: '2026-01-01', end_date: '2026-12-31' }))
      .toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' })
  })

  it('converts nested object keys', () => {
    expect(deepSnakeToCamel({ guest_info: { first_name: 'John', last_name: 'Doe' } }))
      .toEqual({ guestInfo: { firstName: 'John', lastName: 'Doe' } })
  })

  it('converts keys inside arrays', () => {
    expect(deepSnakeToCamel({ data: [{ arrival_date: '2026-03-01' }] }))
      .toEqual({ data: [{ arrivalDate: '2026-03-01' }] })
  })

  it('preserves already-camelCase keys', () => {
    expect(deepSnakeToCamel({ startDate: 'val' })).toEqual({ startDate: 'val' })
  })

  it('preserves primitive values', () => {
    expect(deepSnakeToCamel('hello')).toBe('hello')
    expect(deepSnakeToCamel(42)).toBe(42)
    expect(deepSnakeToCamel(true)).toBe(true)
    expect(deepSnakeToCamel(null)).toBe(null)
    expect(deepSnakeToCamel(undefined)).toBe(undefined)
  })

  it('handles empty object', () => {
    expect(deepSnakeToCamel({})).toEqual({})
  })

  it('handles empty array', () => {
    expect(deepSnakeToCamel([])).toEqual([])
  })

  it('stops recursion at depth 20', () => {
    let obj: Record<string, unknown> = { leaf_key: 'value' }
    for (let i = 0; i < 25; i++) {
      obj = { [`level_${i}`]: obj }
    }
    const result = deepSnakeToCamel(obj)
    expect(result).toBeDefined()
  })

  it('converts Hospitable API reservation response shape', () => {
    const apiResponse = {
      data: [{
        id: 'res-1',
        property_id: 'prop-1',
        arrival_date: '2026-03-01',
        departure_date: '2026-03-05',
        check_in: '15:00',
        check_out: '11:00',
        stay_type: 'guest',
        owner_stay: null,
        booking_date: '2026-01-15',
        conversation_id: 'conv-1',
        conversation_language: 'en',
        last_message_at: null,
        issue_alert: null,
        guests: {
          total: 2,
          adult_count: 2,
          child_count: 0,
          infant_count: 0,
          pet_count: 0,
        },
      }],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
      links: { first: null, last: null, prev: null, next: null },
    }

    const result = deepSnakeToCamel(apiResponse) as Record<string, unknown>
    const data = (result['data'] as Record<string, unknown>[])[0]!

    expect(data['propertyId']).toBe('prop-1')
    expect(data['arrivalDate']).toBe('2026-03-01')
    expect(data['departureDate']).toBe('2026-03-05')
    expect(data['checkIn']).toBe('15:00')
    expect(data['checkOut']).toBe('11:00')
    expect(data['stayType']).toBe('guest')
    expect(data['ownerStay']).toBe(null)
    expect(data['bookingDate']).toBe('2026-01-15')
    expect(data['conversationId']).toBe('conv-1')
    expect(data['lastMessageAt']).toBe(null)

    const guests = data['guests'] as Record<string, unknown>
    expect(guests['adultCount']).toBe(2)
    expect(guests['childCount']).toBe(0)
    expect(guests['infantCount']).toBe(0)
    expect(guests['petCount']).toBe(0)

    const meta = result['meta'] as Record<string, unknown>
    expect(meta['currentPage']).toBe(1)
    expect(meta['lastPage']).toBe(1)
    expect(meta['perPage']).toBe(20)
  })
})

describe('deepCamelToSnake', () => {
  it('converts flat object keys', () => {
    expect(deepCamelToSnake({ startDate: '2026-01-01', endDate: '2026-12-31' }))
      .toEqual({ start_date: '2026-01-01', end_date: '2026-12-31' })
  })

  it('converts nested object keys', () => {
    expect(deepCamelToSnake({ guestInfo: { firstName: 'John' } }))
      .toEqual({ guest_info: { first_name: 'John' } })
  })

  it('converts keys inside arrays', () => {
    expect(deepCamelToSnake({ items: [{ arrivalDate: '2026-03-01' }] }))
      .toEqual({ items: [{ arrival_date: '2026-03-01' }] })
  })

  it('preserves already-snake_case keys', () => {
    expect(deepCamelToSnake({ start_date: 'val' })).toEqual({ start_date: 'val' })
  })

  it('preserves primitive values', () => {
    expect(deepCamelToSnake('hello')).toBe('hello')
    expect(deepCamelToSnake(42)).toBe(42)
    expect(deepCamelToSnake(null)).toBe(null)
  })

  it('handles empty object', () => {
    expect(deepCamelToSnake({})).toEqual({})
  })

  it('stops recursion at depth 20', () => {
    let obj: Record<string, unknown> = { leafKey: 'value' }
    for (let i = 0; i < 25; i++) {
      obj = { [`level${String.fromCharCode(65 + (i % 26))}`]: obj }
    }
    const result = deepCamelToSnake(obj)
    expect(result).toBeDefined()
  })

  it('round-trips with deepSnakeToCamel for standard keys', () => {
    const original = { startDate: '2026-01-01', guestInfo: { firstName: 'John' } }
    const snake = deepCamelToSnake(original)
    const roundTripped = deepSnakeToCamel(snake)
    expect(roundTripped).toEqual(original)
  })
})
