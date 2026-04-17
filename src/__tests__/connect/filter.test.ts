import { describe, it, expect } from 'vitest'
import { ConnectFilter } from '../../connect/filter'
import { ConfigurationError } from '../../errors'

describe('ConnectFilter', () => {
  it('builds field[operator]=value for single-value operators', () => {
    const params = new ConnectFilter()
      .where('arrival_date', 'before', '2026-02-01')
      .where('nights', 'gte', 2)
      .toParams()
    expect(params).toEqual({
      'arrival_date[before]': '2026-02-01',
      'nights[gte]': '2',
    })
  })

  it('joins array values with commas for is/not', () => {
    const params = new ConnectFilter()
      .where('city', 'is', ['New York', 'Seattle'])
      .where('status', 'not', ['deny', 'cancelled'])
      .toParams()
    expect(params).toEqual({
      'city[is]': 'New York,Seattle',
      'status[not]': 'deny,cancelled',
    })
  })

  it('rejects single-value op with an array', () => {
    expect(() => new ConnectFilter().where('nights', 'gte', [2, 3])).toThrow(
      ConfigurationError,
    )
  })

  it('rejects between without exactly two values', () => {
    expect(() => new ConnectFilter().where('amount', 'between', [100])).toThrow(
      ConfigurationError,
    )
    expect(() =>
      new ConnectFilter().where('amount', 'between', [100, 200, 300]),
    ).toThrow(ConfigurationError)
  })

  it('accepts between with two-value array', () => {
    const params = new ConnectFilter()
      .where('amount', 'between', [100, 500])
      .toParams()
    expect(params['amount[between]']).toBe('100,500')
  })

  it('rejects empty arrays for is/not', () => {
    expect(() => new ConnectFilter().where('city', 'is', [])).toThrow(
      ConfigurationError,
    )
  })

  it('emits sort[asc|desc]=field and replaces prior sort', () => {
    const params = new ConnectFilter().sortAsc('arrival_date').sortDesc('booking_date').toParams()
    expect(params).toEqual({ 'sort[desc]': 'booking_date' })
  })

  it('supports sort=latest and sort=oldest shortcuts', () => {
    expect(new ConnectFilter().sortLatest().toParams()).toEqual({ sort: 'latest' })
    expect(new ConnectFilter().sortOldest().toParams()).toEqual({ sort: 'oldest' })
  })

  it('emits _select for partial responses', () => {
    const params = new ConnectFilter()
      .select('id', 'arrival_date', 'financials.host')
      .toParams()
    expect(params._select).toBe('id,arrival_date,financials.host')
  })

  it('select() with no args is a no-op', () => {
    expect(new ConnectFilter().select().toParams()).toEqual({})
  })

  it('page and perPage serialize as strings', () => {
    const params = new ConnectFilter().page(3).perPage(50).toParams()
    expect(params).toEqual({ page: '3', per_page: '50' })
  })

  it('preserves non-sort keys when replacing the sort', () => {
    const params = new ConnectFilter()
      .where('city', 'is', 'LA')
      .sortAsc('arrival_date')
      .sortDesc('booking_date')
      .toParams()
    expect(params).toEqual({
      'city[is]': 'LA',
      'sort[desc]': 'booking_date',
    })
  })

  it('strips `sort` shortcut when overwritten by sortAsc/sortDesc', () => {
    const params = new ConnectFilter().sortLatest().sortAsc('arrival_date').toParams()
    expect(params).toEqual({ 'sort[asc]': 'arrival_date' })
  })

  it('is immutable — chained calls produce independent instances', () => {
    const base = new ConnectFilter().where('city', 'is', ['LA'])
    const branchA = base.perPage(10)
    const branchB = base.perPage(20)
    expect(branchA.toParams().per_page).toBe('10')
    expect(branchB.toParams().per_page).toBe('20')
    expect(base.toParams()).not.toHaveProperty('per_page')
  })
})
