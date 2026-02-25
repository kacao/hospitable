// Main entry point — exports added as modules are implemented
export const VERSION = '0.1.0'

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
