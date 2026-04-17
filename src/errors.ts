import { sanitize } from './utils/sanitize'

export class HospitableError extends Error {
  readonly statusCode: number
  readonly requestId: string | undefined

  constructor(message: string, statusCode: number, requestId?: string) {
    super(message)
    this.name = 'HospitableError'
    this.statusCode = statusCode
    this.requestId = requestId
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown on 401 and 403 responses. AGENTS.md §Error Handling spec mandates
 * a single `HospitableAuthError` covering both. `ForbiddenError` extends
 * this class so `err instanceof HospitableAuthError` catches 403 too.
 *
 * The trailing `statusCode` parameter exists so {@link ForbiddenError} can
 * reuse the same constructor without duplicating the readonly-field dance.
 * Callers should prefer {@link ForbiddenError} over `new AuthenticationError(…, 403)`.
 */
export class AuthenticationError extends HospitableError {
  constructor(
    message = 'Authentication failed',
    requestId?: string,
    statusCode: 401 | 403 = 401,
  ) {
    super(message, statusCode, requestId)
    this.name = 'HospitableAuthError'
  }
}

export class RateLimitError extends HospitableError {
  readonly retryAfter: number

  constructor(retryAfter: number, requestId?: string) {
    super(`Rate limit exceeded. Retry after ${retryAfter}s`, 429, requestId)
    this.name = 'HospitableRateLimitError'
    this.retryAfter = retryAfter
  }
}

export class NotFoundError extends HospitableError {
  readonly resource: string | undefined

  constructor(message = 'Resource not found', requestId?: string, resource?: string) {
    super(message, 404, requestId)
    this.name = 'HospitableNotFoundError'
    this.resource = resource
  }
}

export class ValidationError extends HospitableError {
  readonly fields: Record<string, string[]>

  constructor(message: string, fields: Record<string, string[]> = {}, requestId?: string) {
    super(message, 422, requestId)
    this.name = 'HospitableValidationError'
    this.fields = fields
  }
}

export class ForbiddenError extends AuthenticationError {
  constructor(message = 'Forbidden', requestId?: string) {
    super(message, requestId, 403)
    this.name = 'HospitableForbiddenError'
  }
}

export class ServerError extends HospitableError {
  readonly attempts: number

  constructor(message: string, statusCode: number, attempts: number, requestId?: string) {
    super(message, statusCode, requestId)
    this.name = 'HospitableServerError'
    this.attempts = attempts
  }
}

/**
 * Thrown for client-side configuration / usage errors detected before any
 * HTTP request is made — e.g. calling `InquiryFilter.toParams()` without
 * supplying the required `properties` filter.
 *
 * Carries `statusCode = 0` to signal "no HTTP request happened". It still
 * extends {@link HospitableError} so agents catching the base class handle
 * it alongside runtime HTTP errors without special-casing.
 */
export class ConfigurationError extends HospitableError {
  constructor(message: string) {
    super(message, 0)
    this.name = 'HospitableConfigurationError'
  }
}

export function createErrorFromResponse(
  statusCode: number,
  body: Record<string, unknown>,
  requestId?: string,
  attempts = 1,
  retryAfterOverride?: number,
): HospitableError {
  const message = (body['message'] as string | undefined) ?? `HTTP ${statusCode}`

  switch (statusCode) {
    case 401:
      return new AuthenticationError(message, requestId)
    case 403:
      return new ForbiddenError(message, requestId)
    case 404:
      return new NotFoundError(message, requestId)
    case 400:
    case 422: {
      const rawErrors = (body['errors'] as Record<string, string[]> | undefined) ?? {}
      const errors = sanitize(rawErrors) as Record<string, string[]>
      return new ValidationError(message, errors, requestId)
    }
    case 429: {
      const retryAfter =
        retryAfterOverride ??
        (body['retryAfter'] as number | undefined) ??
        60
      return new RateLimitError(retryAfter, requestId)
    }
    default:
      return new ServerError(message, statusCode, attempts, requestId)
  }
}
