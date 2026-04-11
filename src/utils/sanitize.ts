// Personally-identifying guest fields.
const PII_FIELD_PATTERN = /^(email|phone|phoneNumbers|firstName|lastName|passportNumber|fullName|dateOfBirth|guestName|displayName|hostName|senderId)$/i

// Auth / credential-bearing fields.
const SENSITIVE_PATTERN = /token|secret|password|credential|apiKey|api_key|authorization/i

// Business / financial identity — added when the SDK started wrapping
// /v2/user, /v2/transactions, /v2/payouts. These fields land on response
// bodies and would leak through debug logs or caught-error handlers that
// stringify whole payloads.
//
// Deliberate omissions:
// - `platformId` — overloaded: on payouts it's a bank-transfer reference
//   (sensitive), on messages/reservations it's a public platform ID. Field-
//   name-based redaction can't distinguish; document the trade-off rather
//   than over-redact and hide useful debug info.
// - `city`, `state`, `country`, `company` — too broad to be individually
//   identifying. The narrow fields (streetLine*, postalCode) provide the
//   actual PII surface.
// - `amount`, `paidOutAmount` — amounts are sensitive but not identifying;
//   redacting them cripples debugging flow analysis.
const SENSITIVE_BIZ_PATTERN = /^(taxId|tax_id|vat|bankAccount|bank_account|streetLine1|street_line1|streetLine2|street_line2|postalCode|postal_code)$/i

/**
 * Recursively masks PII and sensitive fields in an object for safe logging.
 * Does NOT mutate the original — returns a new object with masked values.
 * Only affects log output; never called on actual API payloads.
 *
 * Patterns matched:
 * - {@link PII_FIELD_PATTERN} — guest-identifying fields (email, names, phone…)
 * - {@link SENSITIVE_PATTERN} — auth/credentials (token, secret, apiKey…)
 * - {@link SENSITIVE_BIZ_PATTERN} — business/financial identity
 *   (taxId, vat, bankAccount, streetLine*, postalCode)
 *
 * The patterns check both camelCase and snake_case forms so this function is
 * safe to call on raw server responses (pre-`deepSnakeToCamel`) as well as
 * post-conversion objects.
 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 10) return value // prevent infinite recursion
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1))

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (
      PII_FIELD_PATTERN.test(key) ||
      SENSITIVE_PATTERN.test(key) ||
      SENSITIVE_BIZ_PATTERN.test(key)
    ) {
      result[key] = '***'
    } else {
      result[key] = sanitize(val, depth + 1)
    }
  }
  return result
}
