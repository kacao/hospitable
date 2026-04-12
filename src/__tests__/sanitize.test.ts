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

  describe('business / financial identity redaction', () => {
    it('masks taxId, vat, and tax_id (snake_case variant)', () => {
      expect(sanitize({ taxId: '12-3456789', vat: 'GB123456789' })).toEqual({
        taxId: '***',
        vat: '***',
      })
      expect(sanitize({ tax_id: '12-3456789' })).toEqual({ tax_id: '***' })
    })

    it('masks bankAccount and bank_account', () => {
      expect(
        sanitize({ bankAccount: 'Checking ••4169 (USD)' }),
      ).toEqual({ bankAccount: '***' })
      expect(
        sanitize({ bank_account: 'Checking ••4169 (USD)' }),
      ).toEqual({ bank_account: '***' })
    })

    it('masks billing address fine-grained fields', () => {
      expect(
        sanitize({
          streetLine1: '123 Main St',
          streetLine2: 'Apt 4',
          postalCode: '90210',
        }),
      ).toEqual({
        streetLine1: '***',
        streetLine2: '***',
        postalCode: '***',
      })
    })

    it('masks snake_case address variants', () => {
      expect(
        sanitize({
          street_line1: '123 Main St',
          street_line2: 'Apt 4',
          postal_code: '90210',
        }),
      ).toEqual({
        street_line1: '***',
        street_line2: '***',
        postal_code: '***',
      })
    })

    it('leaves broader location fields (city, state, country, company) unredacted', () => {
      // Deliberate: these are too broad to be individually identifying,
      // and redacting them cripples debugging. See sanitize.ts comment.
      expect(
        sanitize({
          city: 'Anaheim',
          state: 'CA',
          country: 'US',
          company: 'Acme Rentals LLC',
        }),
      ).toEqual({
        city: 'Anaheim',
        state: 'CA',
        country: 'US',
        company: 'Acme Rentals LLC',
      })
    })

    it('leaves amounts unredacted (sensitive but not identifying)', () => {
      expect(
        sanitize({
          amount: 19148,
          paidOutAmount: { amount: 19148, formatted: '$191.48', currency: 'USD' },
        }),
      ).toEqual({
        amount: 19148,
        paidOutAmount: { amount: 19148, formatted: '$191.48', currency: 'USD' },
      })
    })

    it('passes wifiPassword through unchanged (explicit SAFE_OVERRIDES carve-out)', () => {
      // Wi-Fi passwords are semi-public by design — hosts share them
      // with every guest. Agents fetching property.details.wifiPassword
      // to include in a check-in message need to see the real value in
      // debug output, so sanitize() deliberately does NOT redact it
      // despite the broad /password/i pattern in SENSITIVE_PATTERN.
      // See SAFE_OVERRIDES in src/utils/sanitize.ts for rationale.
      const property = {
        id: 'prop-1',
        name: 'Beach House',
        details: {
          wifiName: 'Beach-5G',
          wifiPassword: 'supersecret123',
          houseManual: 'Check in at 3pm',
        },
      }
      const result = sanitize(property) as typeof property
      expect(result.details.wifiPassword).toBe('supersecret123')
      expect(result.details.wifiName).toBe('Beach-5G')
      expect(result.details.houseManual).toBe('Check in at 3pm')
      expect(result.id).toBe('prop-1')
    })

    it('passes snake_case wifi_password through unchanged too', () => {
      // Raw API shape before deepSnakeToCamel runs — the override
      // applies to both camelCase and snake_case variants.
      const property = {
        details: { wifi_password: 'raw-api-pw', wifi_name: 'Beach' },
      }
      const result = sanitize(property) as typeof property
      expect(result.details.wifi_password).toBe('raw-api-pw')
      expect(result.details.wifi_name).toBe('Beach')
    })

    it('passes smartlockCode through unchanged', () => {
      // Same rationale as wifiPassword: the smart-lock access code is
      // a credential the agent needs to send to the guest. Agents
      // fetching reservation.smartlockCode to generate a check-in
      // message need to see the real value in debug output.
      // smartlockCode doesn't match any sanitize pattern naturally,
      // but this test pins the behavior so future pattern additions
      // don't accidentally capture it.
      const reservation = {
        id: 'res-1',
        code: 'HMNPQQH5KK',
        smartlockCode: '9588',
      }
      const result = sanitize(reservation) as typeof reservation
      expect(result.smartlockCode).toBe('9588')
    })

    it('passes snake_case smartlock_code through unchanged', () => {
      const reservation = { smartlock_code: '1234' }
      const result = sanitize(reservation) as typeof reservation
      expect(result.smartlock_code).toBe('1234')
    })

    it('still masks a bare "password" field (defense-in-depth retained)', () => {
      // The SAFE_OVERRIDES carve-out is scoped to wifiPassword
      // specifically. A future endpoint returning a raw `password`
      // field would still be redacted by the broad SENSITIVE_PATTERN.
      const payload = { password: 'hunter2', user: { password: 'p@ss' } }
      const result = sanitize(payload) as typeof payload
      expect(result.password).toBe('***')
      expect(result.user.password).toBe('***')
    })

    it('masks a full User response in one pass', () => {
      const user = {
        id: 'user-1',
        email: 'host@example.com',
        name: 'Host Name',
        business: true,
        company: 'Acme Rentals LLC',
        vat: 'GB123456789',
        taxId: '12-3456789',
        streetLine1: '123 Main St',
        streetLine2: null,
        postalCode: '90210',
        city: 'Anytown',
        state: 'CA',
        country: 'US',
      }
      const result = sanitize(user) as typeof user
      expect(result.email).toBe('***')
      expect(result.vat).toBe('***')
      expect(result.taxId).toBe('***')
      expect(result.streetLine1).toBe('***')
      expect(result.postalCode).toBe('***')
      // Unredacted, intentionally:
      expect(result.id).toBe('user-1')
      expect(result.name).toBe('Host Name')
      expect(result.business).toBe(true)
      expect(result.company).toBe('Acme Rentals LLC')
      expect(result.city).toBe('Anytown')
      expect(result.country).toBe('US')
    })
  })
})
