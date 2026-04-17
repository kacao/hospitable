export const VERSION = '0.7.1'

export { HospitableClient } from './client'
export type { HospitableClientConfig, ResourceCacheConfig } from './client'

// Connect API — partner-facing, multi-customer integration surface.
// Public API types (e.g. Reservation, Review, Transaction) collide with
// Connect API types of the same name, so Connect lives under a namespace.
// Usage:
//   import { HospitableConnectClient, Connect } from 'hospitable'
//   const connect = new HospitableConnectClient({ token })
//   const filter = new Connect.ConnectFilter().where('status', 'is', ['accept'])
export { HospitableConnectClient } from './connect/client'
export type { HospitableConnectClientConfig } from './connect/client'
export * as Connect from './connect'

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
// `ForbiddenError extends AuthenticationError`, so `instanceof HospitableAuthError`
// catches both 401 and 403 per the AGENTS.md spec.
export {
  AuthenticationError as HospitableAuthError,
  ForbiddenError as HospitableForbiddenError,
  RateLimitError as HospitableRateLimitError,
  NotFoundError as HospitableNotFoundError,
  ValidationError as HospitableValidationError,
  ServerError as HospitableServerError,
  ConfigurationError as HospitableConfigurationError,
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

export { KnowledgeHubResource } from './resources'

export { sanitize, MemoryCache, cacheKey } from './utils'
export type { CacheConfig } from './utils'

export { ReservationFilter, PropertyFilter, InquiryFilter } from './filters'
