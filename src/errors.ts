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

export class AuthenticationError extends HospitableError {
  constructor(message = 'Authentication failed', requestId?: string) {
    super(message, 401, requestId)
    this.name = 'AuthenticationError'
  }
}

export class RateLimitError extends HospitableError {
  readonly retryAfter: number

  constructor(retryAfter: number, requestId?: string) {
    super(`Rate limit exceeded. Retry after ${retryAfter}s`, 429, requestId)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class NotFoundError extends HospitableError {
  readonly resource: string | undefined

  constructor(message = 'Resource not found', requestId?: string, resource?: string) {
    super(message, 404, requestId)
    this.name = 'NotFoundError'
    this.resource = resource
  }
}

export class ValidationError extends HospitableError {
  readonly fields: Record<string, string[]>

  constructor(message: string, fields: Record<string, string[]> = {}, requestId?: string) {
    super(message, 422, requestId)
    this.name = 'ValidationError'
    this.fields = fields
  }
}

export class ForbiddenError extends HospitableError {
  constructor(message = 'Forbidden', requestId?: string) {
    super(message, 403, requestId)
    this.name = 'ForbiddenError'
  }
}

export class ServerError extends HospitableError {
  readonly attempts: number

  constructor(message: string, statusCode: number, attempts: number, requestId?: string) {
    super(message, statusCode, requestId)
    this.name = 'ServerError'
    this.attempts = attempts
  }
}

export function createErrorFromResponse(
  statusCode: number,
  body: Record<string, unknown>,
  requestId?: string,
  attempts = 1,
): HospitableError {
  const message = (body['message'] as string | undefined) ?? `HTTP ${statusCode}`

  switch (statusCode) {
    case 401:
      return new AuthenticationError(message, requestId)
    case 403:
      return new ForbiddenError(message, requestId)
    case 404:
      return new NotFoundError(message, requestId)
    case 422: {
      const errors = (body['errors'] as Record<string, string[]> | undefined) ?? {}
      return new ValidationError(message, errors, requestId)
    }
    case 429: {
      const retryAfter = (body['retryAfter'] as number | undefined) ?? 60
      return new RateLimitError(retryAfter, requestId)
    }
    default:
      return new ServerError(message, statusCode, attempts, requestId)
  }
}
