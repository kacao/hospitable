import { describe, it, expect } from 'vitest'
import { sanitize } from '../utils/sanitize'

describe('sanitize', () => {
  it('masks email field', () => {
    expect(sanitize({ email: 'user@example.com' })).toEqual({ email: '***' })
  })

  it('masks phone field', () => {
    expect(sanitize({ phone: '+1-555-1234' })).toEqual({ phone: '***' })
  })

  it('masks firstName and lastName fields', () => {
    expect(sanitize({ firstName: 'John', lastName: 'Doe' })).toEqual({
      firstName: '***',
      lastName: '***',
    })
  })

  it('masks passportNumber field', () => {
    expect(sanitize({ passportNumber: 'AB123456' })).toEqual({ passportNumber: '***' })
  })

  it('masks sensitive fields: token, secret, password, apiKey, api_key', () => {
    expect(
      sanitize({
        token: 'abc',
        secret: 'xyz',
        password: 'pass',
        apiKey: 'key1',
        api_key: 'key2',
      }),
    ).toEqual({
      token: '***',
      secret: '***',
      password: '***',
      apiKey: '***',
      api_key: '***',
    })
  })

  it('passes through non-PII fields unchanged', () => {
    expect(sanitize({ id: 42, name: 'Test', city: 'Berlin' })).toEqual({
      id: 42,
      name: 'Test',
      city: 'Berlin',
    })
  })

  it('masks nested PII while passing through non-PII', () => {
    const input = { guest: { id: 1, email: 'g@example.com' } }
    expect(sanitize(input)).toEqual({ guest: { id: 1, email: '***' } })
  })

  it('masks PII in each element of an array independently', () => {
    const input = [
      { id: 1, email: 'a@example.com' },
      { id: 2, email: 'b@example.com', city: 'Paris' },
    ]
    expect(sanitize(input)).toEqual([
      { id: 1, email: '***' },
      { id: 2, email: '***', city: 'Paris' },
    ])
  })

  it('does not mutate the original object', () => {
    const original = { email: 'user@example.com', id: 99 }
    const copy = { ...original }
    sanitize(original)
    expect(original).toEqual(copy)
  })

  it('passes null and primitives through as-is', () => {
    expect(sanitize(null)).toBeNull()
    expect(sanitize(42)).toBe(42)
    expect(sanitize('hello')).toBe('hello')
    expect(sanitize(true)).toBe(true)
  })

  it('masks PII at any depth in deeply nested objects', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                email: 'deep@example.com',
                id: 7,
              },
            },
          },
        },
      },
    }
    const result = sanitize(input) as typeof input
    expect(result.level1.level2.level3.level4.level5.email).toBe('***')
    expect(result.level1.level2.level3.level4.level5.id).toBe(7)
  })

  it('stops recursing beyond depth 10 and returns value as-is', () => {
    // Build a 12-level deep object
    let obj: Record<string, unknown> = { email: 'deep@test.com' }
    for (let i = 0; i < 12; i++) {
      obj = { nested: obj }
    }
    // Should not throw and should return something (depth guard triggers)
    expect(() => sanitize(obj)).not.toThrow()
  })
})
