const PII_FIELD_PATTERN = /^(email|phone|firstName|lastName|passportNumber|fullName|dateOfBirth)$/i
const SENSITIVE_PATTERN = /token|secret|password|credential|apiKey|api_key/i

/**
 * Recursively masks PII and sensitive fields in an object for safe logging.
 * Does NOT mutate the original — returns a new object with masked values.
 * Only affects log output; never called on actual API payloads.
 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 10) return value // prevent infinite recursion
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1))

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (PII_FIELD_PATTERN.test(key) || SENSITIVE_PATTERN.test(key)) {
      result[key] = '***'
    } else {
      result[key] = sanitize(val, depth + 1)
    }
  }
  return result
}
