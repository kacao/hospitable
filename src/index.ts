export const VERSION = '0.1.0'

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
  createErrorFromResponse,
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

export { sanitize, MemoryCache, cacheKey } from './utils'
export type { CacheConfig } from './utils'

export { ReservationFilter, PropertyFilter } from './filters'
