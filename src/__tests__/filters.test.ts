import { describe, it, expect } from 'vitest'
import { ReservationFilter, PropertyFilter, InquiryFilter } from '../filters'
import { ConfigurationError, HospitableError } from '../errors'

// Reservation filter now requires .properties() before .toParams() — helper
// builds a filter already primed with properties so tests can focus on the
// method under test without repeating setup.
function base(): ReservationFilter {
  return new ReservationFilter().properties(['prop-1'])
}

describe('ReservationFilter', () => {
  it('throws ConfigurationError when .toParams() is called without properties', () => {
    expect(() => new ReservationFilter().toParams()).toThrowError(ConfigurationError)
    expect(() => new ReservationFilter().toParams()).toThrowError(HospitableError)
    expect(() => new ReservationFilter().toParams()).toThrowError(/properties/i)
  })

  it('throws ConfigurationError when properties is set to an empty array', () => {
    expect(() => new ReservationFilter().properties([]).toParams()).toThrowError(
      ConfigurationError,
    )
  })

  it('is immutable — each method returns new instance, original unchanged', () => {
    const original = base()
    const next = original.checkinAfter('2026-01-01')
    expect(next).not.toBe(original)
    expect(original.toParams().startDate).toBeUndefined()
    expect(next.toParams().startDate).toBe('2026-01-01')
  })

  it('.checkinAfter sets startDate', () => {
    const params = base().checkinAfter('2026-01-01').toParams()
    expect(params.startDate).toBe('2026-01-01')
  })

  it('.checkinBefore sets endDate', () => {
    const params = base().checkinBefore('2026-12-31').toParams()
    expect(params.endDate).toBe('2026-12-31')
  })

  it('.dateQuery sets dateQuery to checkin', () => {
    const params = base().dateQuery('checkin').toParams()
    expect(params.dateQuery).toBe('checkin')
  })

  it('.dateQuery sets dateQuery to checkout', () => {
    const params = base().dateQuery('checkout').toParams()
    expect(params.dateQuery).toBe('checkout')
  })

  it('.lastMessageAt sets lastMessageAt', () => {
    const params = base().lastMessageAt('2026-01-15 14:30:00').toParams()
    expect(params.lastMessageAt).toBe('2026-01-15 14:30:00')
  })

  it('.status sets single status string', () => {
    const params = base().status('accepted').toParams()
    expect(params.status).toBe('accepted')
  })

  it('.status sets array of statuses', () => {
    const params = base().status(['accepted', 'request']).toParams()
    expect(params.status).toEqual(['accepted', 'request'])
  })

  it('.properties sets property ids', () => {
    const params = new ReservationFilter().properties(['a', 'b']).toParams()
    expect(params.properties).toEqual(['a', 'b'])
  })

  it('.include joins fields as comma-separated string', () => {
    const params = base().include('guest', 'properties', 'review').toParams()
    expect(params.include).toBe('guest,properties,review')
  })

  it('.include accepts all seven ReservationIncludeField values', () => {
    // Regression guard: if any literal is removed from the union,
    // this test breaks at compile time. The array annotation forces
    // the compiler to verify each literal is still in the union.
    const params = base()
      .include('guest', 'user', 'financials', 'listings', 'properties', 'review', 'smartlock_code')
      .toParams()
    expect(params.include).toBe('guest,user,financials,listings,properties,review,smartlock_code')
  })

  it('chaining sets all params', () => {
    const params = base()
      .checkinAfter('2026-01-01')
      .dateQuery('checkout')
      .lastMessageAt('2026-01-15 00:00:00')
      .status('accepted')
      .include('guest')
      .toParams()
    expect(params).toEqual({
      properties: ['prop-1'],
      startDate: '2026-01-01',
      dateQuery: 'checkout',
      lastMessageAt: '2026-01-15 00:00:00',
      status: 'accepted',
      include: 'guest',
    })
  })

  it('.checkinBefore() is immutable', () => {
    const original = base().checkinAfter('2026-01-01')
    const next = original.checkinBefore('2026-12-31')
    expect(next).not.toBe(original)
    expect(original.toParams().endDate).toBeUndefined()
    expect(next.toParams().endDate).toBe('2026-12-31')
  })

  it('.include() is immutable', () => {
    const original = base()
    const next = original.include('guest')
    expect(next).not.toBe(original)
    expect(original.toParams().include).toBeUndefined()
    expect(next.toParams().include).toBe('guest')
  })

  it('.perPage() is immutable', () => {
    const original = base()
    const next = original.perPage(50)
    expect(next).not.toBe(original)
    expect(original.toParams().perPage).toBeUndefined()
    expect(next.toParams().perPage).toBe(50)
  })

  it('.properties() is immutable', () => {
    const original = base()
    const next = original.properties(['a', 'b'])
    expect(next).not.toBe(original)
    expect(original.toParams().properties).toEqual(['prop-1'])
    expect(next.toParams().properties).toEqual(['a', 'b'])
  })

  it('.dateQuery() is immutable', () => {
    const original = base().dateQuery('checkin')
    const next = original.dateQuery('checkout')
    expect(next).not.toBe(original)
    expect(original.toParams().dateQuery).toBe('checkin')
    expect(next.toParams().dateQuery).toBe('checkout')
  })
})

describe('PropertyFilter', () => {
  it('.tags sets tag ids', () => {
    const params = new PropertyFilter().tags(['t1']).toParams()
    expect(params).toEqual({ tags: ['t1'] })
  })

  it('.perPage sets perPage', () => {
    const params = new PropertyFilter().perPage(50).toParams()
    expect(params).toEqual({ perPage: 50 })
  })

  it('.include joins fields as comma-separated string', () => {
    const params = new PropertyFilter().include('user', 'listings').toParams()
    expect(params.include).toBe('user,listings')
  })

  it('.include accepts all four valid PropertyIncludeField values', () => {
    const params = new PropertyFilter()
      .include('user', 'listings', 'details', 'bookings')
      .toParams()
    expect(params.include).toBe('user,listings,details,bookings')
  })

  it('.include() is immutable', () => {
    const original = new PropertyFilter()
    const next = original.include('user')
    expect(next).not.toBe(original)
    expect(original.toParams().include).toBeUndefined()
    expect(next.toParams().include).toBe('user')
  })

  it('chains tags + include + perPage', () => {
    const params = new PropertyFilter()
      .tags(['Anaheim'])
      .include('user', 'details')
      .perPage(50)
      .toParams()
    expect(params).toEqual({
      tags: ['Anaheim'],
      include: 'user,details',
      perPage: 50,
    })
  })

  it('is immutable — each method returns new instance, original unchanged', () => {
    const original = new PropertyFilter()
    const next = original.tags(['t1'])
    expect(next).not.toBe(original)
    expect(original.toParams()).toEqual({})
    expect(next.toParams()).toEqual({ tags: ['t1'] })
  })

  it('.perPage() is immutable', () => {
    const original = new PropertyFilter()
    const next = original.perPage(25)
    expect(next).not.toBe(original)
    expect(original.toParams().perPage).toBeUndefined()
    expect(next.toParams().perPage).toBe(25)
  })
})

describe('ReservationFilter extra', () => {
  it('.perPage sets perPage', () => {
    const params = base().perPage(25).toParams()
    expect(params.perPage).toBe(25)
  })
})

describe('InquiryFilter', () => {
  it('chains properties, include, lastMessageAfter, perPage into params', () => {
    const params = new InquiryFilter()
      .properties(['prop-1'])
      .include('guest', 'properties')
      .lastMessageAfter('2026-01-01T00:00:00Z')
      .perPage(50)
      .toParams()
    expect(params).toEqual({
      properties: ['prop-1'],
      include: 'guest,properties',
      lastMessageAt: '2026-01-01T00:00:00Z',
      perPage: 50,
    })
  })

  it('.include accepts all five InquiryIncludeField values valid on list()', () => {
    // Note: `messages` is excluded here because the API rejects
    // include=messages on the /v2/inquiries list endpoint with
    // "You cannot include messages when fetching all inquiries".
    // The messages include is only usable on `client.inquiries.get()`.
    const params = new InquiryFilter()
      .properties(['prop-1'])
      .include('guest', 'user', 'financials', 'listings', 'properties')
      .toParams()
    expect(params.include).toBe('guest,user,financials,listings,properties')
  })

  it('is immutable — each method returns new instance, original unchanged', () => {
    const baseF = new InquiryFilter().properties(['prop-1'])
    const next = baseF.include('guest')
    expect(next).not.toBe(baseF)
    expect(baseF.toParams().include).toBeUndefined()
    expect(next.toParams().include).toBe('guest')
  })

  it('.page sets page for explicit pagination', () => {
    const params = new InquiryFilter().properties(['prop-1']).page(3).toParams()
    expect(params.page).toBe(3)
  })

  it('.properties() is immutable', () => {
    const original = new InquiryFilter().properties(['a'])
    const next = original.properties(['b'])
    expect(original.toParams().properties).toEqual(['a'])
    expect(next.toParams().properties).toEqual(['b'])
  })

  it('throws ConfigurationError when .toParams() is called without properties', () => {
    expect(() => new InquiryFilter().toParams()).toThrowError(ConfigurationError)
    expect(() => new InquiryFilter().toParams()).toThrowError(HospitableError)
    expect(() => new InquiryFilter().toParams()).toThrowError(/properties.*required/i)
  })

  it('throws ConfigurationError when properties is set to an empty array', () => {
    expect(() => new InquiryFilter().properties([]).toParams()).toThrowError(ConfigurationError)
    expect(() => new InquiryFilter().properties([]).toParams()).toThrowError(
      /properties.*required/i,
    )
  })
})
