export const VERSION = '0.5.1'

export { HospitableClient } from './client'
export type { HospitableClientConfig, ResourceCacheConfig } from './client'

export {
  HospitableError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ServerError,
  ConfigurationError,
  createErrorFromResponse,
} from './errors'

// Aliases mandated by AGENTS.md — existing short names are retained for
// backward compatibility; these let consumers catch by the spec names.
export {
  AuthenticationError as HospitableAuthError,
  RateLimitError as HospitableRateLimitError,
  ValidationError as HospitableValidationError,
  ServerError as HospitableServerError,
} from './errors'

export * from './models/index'

export { TokenManager } from './auth'
export type { TokenManagerConfig } from './auth'

export { paginate, collectAll } from './http/paginate'
export type { PageFetcher } from './http/paginate'

export { PropertiesResource } from './resources'
export type { PropertyListParams } from './resources'

export { ReservationsResource } from './resources'

export { MessagesResource } from './resources'

export { CalendarResource } from './resources'

export { ReviewsResource } from './resources'

export { InquiriesResource } from './resources'

export { UserResource } from './resources'

export { TransactionsResource } from './resources'

export { PayoutsResource } from './resources'

export { sanitize, MemoryCache, cacheKey } from './utils'
export type { CacheConfig } from './utils'

export { ReservationFilter, PropertyFilter, InquiryFilter } from './filters'
