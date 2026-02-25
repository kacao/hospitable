import { describe, it, expect } from 'vitest'
import {
  HospitableError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ServerError,
  createErrorFromResponse,
} from '../errors'

describe('HospitableError', () => {
  it('has correct name, statusCode, message', () => {
    const err = new HospitableError('base error', 500)
    expect(err.name).toBe('HospitableError')
    expect(err.statusCode).toBe(500)
    expect(err.message).toBe('base error')
    expect(err.requestId).toBeUndefined()
  })

  it('stores requestId', () => {
    const err = new HospitableError('oops', 500, 'req-abc')
    expect(err.requestId).toBe('req-abc')
  })

  it('is instanceof Error and HospitableError', () => {
    const err = new HospitableError('x', 500)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(HospitableError)
  })
})

describe('AuthenticationError', () => {
  it('has correct name and statusCode', () => {
    const err = new AuthenticationError()
    expect(err.name).toBe('AuthenticationError')
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Authentication failed')
  })

  it('accepts custom message and requestId', () => {
    const err = new AuthenticationError('Invalid token', 'req-1')
    expect(err.message).toBe('Invalid token')
    expect(err.requestId).toBe('req-1')
  })

  it('is instanceof HospitableError and AuthenticationError', () => {
    const err = new AuthenticationError()
    expect(err).toBeInstanceOf(HospitableError)
    expect(err).toBeInstanceOf(AuthenticationError)
  })
})

describe('RateLimitError', () => {
  it('has correct name, statusCode, retryAfter, and message', () => {
    const err = new RateLimitError(30)
    expect(err.name).toBe('RateLimitError')
    expect(err.statusCode).toBe(429)
    expect(err.retryAfter).toBe(30)
    expect(err.message).toBe('Rate limit exceeded. Retry after 30s')
  })

  it('stores requestId', () => {
    const err = new RateLimitError(60, 'req-2')
    expect(err.requestId).toBe('req-2')
  })

  it('is instanceof HospitableError and RateLimitError', () => {
    const err = new RateLimitError(10)
    expect(err).toBeInstanceOf(HospitableError)
    expect(err).toBeInstanceOf(RateLimitError)
  })
})

describe('NotFoundError', () => {
  it('has correct name and statusCode with defaults', () => {
    const err = new NotFoundError()
    expect(err.name).toBe('NotFoundError')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Resource not found')
    expect(err.resource).toBeUndefined()
  })

  it('stores resource', () => {
    const err = new NotFoundError('Listing not found', 'req-3', 'listing')
    expect(err.resource).toBe('listing')
    expect(err.message).toBe('Listing not found')
    expect(err.requestId).toBe('req-3')
  })

  it('is instanceof HospitableError and NotFoundError', () => {
    const err = new NotFoundError()
    expect(err).toBeInstanceOf(HospitableError)
    expect(err).toBeInstanceOf(NotFoundError)
  })
})

describe('ValidationError', () => {
  it('has correct name and statusCode with empty fields default', () => {
    const err = new ValidationError('Invalid input')
    expect(err.name).toBe('ValidationError')
    expect(err.statusCode).toBe(422)
    expect(err.message).toBe('Invalid input')
    expect(err.fields).toEqual({})
  })

  it('stores fields and requestId', () => {
    const fields = { email: ['is invalid'], name: ['is too short'] }
    const err = new ValidationError('Validation failed', fields, 'req-4')
    expect(err.fields).toEqual(fields)
    expect(err.requestId).toBe('req-4')
  })

  it('is instanceof HospitableError and ValidationError', () => {
    const err = new ValidationError('bad')
    expect(err).toBeInstanceOf(HospitableError)
    expect(err).toBeInstanceOf(ValidationError)
  })
})

describe('ForbiddenError', () => {
  it('has correct name and statusCode with default message', () => {
    const err = new ForbiddenError()
    expect(err.name).toBe('ForbiddenError')
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('Forbidden')
  })

  it('accepts custom message and requestId', () => {
    const err = new ForbiddenError('Access denied', 'req-5')
    expect(err.message).toBe('Access denied')
    expect(err.requestId).toBe('req-5')
  })

  it('is instanceof HospitableError and ForbiddenError', () => {
    const err = new ForbiddenError()
    expect(err).toBeInstanceOf(HospitableError)
    expect(err).toBeInstanceOf(ForbiddenError)
  })
})

describe('ServerError', () => {
  it('has correct name, statusCode, and attempts', () => {
    const err = new ServerError('Internal error', 500, 3)
    expect(err.name).toBe('ServerError')
    expect(err.statusCode).toBe(500)
    expect(err.attempts).toBe(3)
    expect(err.message).toBe('Internal error')
  })

  it('stores requestId', () => {
    const err = new ServerError('Gateway timeout', 504, 2, 'req-6')
    expect(err.requestId).toBe('req-6')
    expect(err.attempts).toBe(2)
  })

  it('is instanceof HospitableError and ServerError', () => {
    const err = new ServerError('err', 500, 1)
    expect(err).toBeInstanceOf(HospitableError)
    expect(err).toBeInstanceOf(ServerError)
  })
})

describe('createErrorFromResponse', () => {
  it('maps 401 to AuthenticationError', () => {
    const err = createErrorFromResponse(401, { message: 'Unauthorized' }, 'req-a')
    expect(err).toBeInstanceOf(AuthenticationError)
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Unauthorized')
    expect(err.requestId).toBe('req-a')
  })

  it('maps 403 to ForbiddenError', () => {
    const err = createErrorFromResponse(403, { message: 'No access' })
    expect(err).toBeInstanceOf(ForbiddenError)
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('No access')
  })

  it('maps 404 to NotFoundError', () => {
    const err = createErrorFromResponse(404, { message: 'Not found' })
    expect(err).toBeInstanceOf(NotFoundError)
    expect(err.statusCode).toBe(404)
  })

  it('maps 422 to ValidationError with fields', () => {
    const body = { message: 'Unprocessable', errors: { name: ['blank'] } }
    const err = createErrorFromResponse(422, body) as ValidationError
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.statusCode).toBe(422)
    expect(err.fields).toEqual({ name: ['blank'] })
  })

  it('maps 422 with missing errors to empty fields', () => {
    const err = createErrorFromResponse(422, { message: 'Invalid' }) as ValidationError
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.fields).toEqual({})
  })

  it('maps 429 to RateLimitError with retryAfter', () => {
    const body = { message: 'Too many requests', retryAfter: 45 }
    const err = createErrorFromResponse(429, body) as RateLimitError
    expect(err).toBeInstanceOf(RateLimitError)
    expect(err.statusCode).toBe(429)
    expect(err.retryAfter).toBe(45)
  })

  it('maps 429 with missing retryAfter to default 60', () => {
    const err = createErrorFromResponse(429, {}) as RateLimitError
    expect(err).toBeInstanceOf(RateLimitError)
    expect(err.retryAfter).toBe(60)
  })

  it('maps 500 to ServerError', () => {
    const err = createErrorFromResponse(500, { message: 'Server exploded' }, 'req-b', 3) as ServerError
    expect(err).toBeInstanceOf(ServerError)
    expect(err.statusCode).toBe(500)
    expect(err.attempts).toBe(3)
    expect(err.requestId).toBe('req-b')
  })

  it('maps 503 to ServerError with default attempts=1', () => {
    const err = createErrorFromResponse(503, {}) as ServerError
    expect(err).toBeInstanceOf(ServerError)
    expect(err.statusCode).toBe(503)
    expect(err.attempts).toBe(1)
  })

  it('uses HTTP status fallback message when body has no message', () => {
    const err = createErrorFromResponse(500, {})
    expect(err.message).toBe('HTTP 500')
  })

  it('all returned errors are instanceof HospitableError', () => {
    const codes = [401, 403, 404, 422, 429, 500, 502]
    for (const code of codes) {
      expect(createErrorFromResponse(code, {})).toBeInstanceOf(HospitableError)
    }
  })
})
