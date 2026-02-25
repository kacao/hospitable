import { describe, it, expect } from 'vitest'
import { ReservationFilter, PropertyFilter } from '../filters'

describe('ReservationFilter', () => {
  it('is immutable — each method returns new instance, original unchanged', () => {
    const original = new ReservationFilter()
    const next = original.checkinAfter('2026-01-01')
    expect(next).not.toBe(original)
    expect(original.toParams()).toEqual({})
    expect(next.toParams()).toEqual({ startDate: '2026-01-01' })
  })

  it('.checkinAfter sets startDate', () => {
    const params = new ReservationFilter().checkinAfter('2026-01-01').toParams()
    expect(params).toEqual({ startDate: '2026-01-01' })
  })

  it('.checkinBefore sets endDate', () => {
    const params = new ReservationFilter().checkinBefore('2026-12-31').toParams()
    expect(params).toEqual({ endDate: '2026-12-31' })
  })

  it('.status sets single status string', () => {
    const params = new ReservationFilter().status('confirmed').toParams()
    expect(params).toEqual({ status: 'confirmed' })
  })

  it('.status sets array of statuses', () => {
    const params = new ReservationFilter().status(['confirmed', 'pending']).toParams()
    expect(params).toEqual({ status: ['confirmed', 'pending'] })
  })

  it('.properties sets property ids', () => {
    const params = new ReservationFilter().properties(['a', 'b']).toParams()
    expect(params).toEqual({ properties: ['a', 'b'] })
  })

  it('.include joins fields as comma-separated string', () => {
    const params = new ReservationFilter().include('guest', 'properties').toParams()
    expect(params).toEqual({ include: 'guest,properties' })
  })

  it('chaining sets all params', () => {
    const params = new ReservationFilter()
      .checkinAfter('2026-01-01')
      .status('confirmed')
      .include('guest')
      .toParams()
    expect(params).toEqual({
      startDate: '2026-01-01',
      status: 'confirmed',
      include: 'guest',
    })
  })

  it('.checkinBefore() is immutable', () => {
    const original = new ReservationFilter({ startDate: '2026-01-01' })
    const next = original.checkinBefore('2026-12-31')
    expect(next).not.toBe(original)
    expect(original.toParams().endDate).toBeUndefined()
    expect(next.toParams().endDate).toBe('2026-12-31')
  })

  it('.include() is immutable', () => {
    const original = new ReservationFilter()
    const next = original.include('guest')
    expect(next).not.toBe(original)
    expect(original.toParams().include).toBeUndefined()
    expect(next.toParams().include).toBe('guest')
  })

  it('.perPage() is immutable', () => {
    const original = new ReservationFilter()
    const next = original.perPage(50)
    expect(next).not.toBe(original)
    expect(original.toParams().perPage).toBeUndefined()
    expect(next.toParams().perPage).toBe(50)
  })

  it('.properties() is immutable', () => {
    const original = new ReservationFilter()
    const next = original.properties(['a', 'b'])
    expect(next).not.toBe(original)
    expect(original.toParams().properties).toBeUndefined()
    expect(next.toParams().properties).toEqual(['a', 'b'])
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
    const params = new ReservationFilter().perPage(25).toParams()
    expect(params).toEqual({ perPage: 25 })
  })
})
