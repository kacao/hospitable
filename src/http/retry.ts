import { ServerError } from '../errors'

export interface RetryConfig {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  onRateLimit?: (info: { retryAfter: number; endpoint: string; attempt: number }) => void
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

function jitteredDelay(base: number, attempt: number, max: number): number {
  const exponential = Math.min(base * Math.pow(2, attempt - 1), max)
  const jitter = exponential * 0.25 * (Math.random() * 2 - 1)
  return Math.max(0, exponential + jitter)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  endpoint: string,
  config: RetryConfig = {},
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelay = 1000,
    maxDelay = 60_000,
    onRateLimit,
  } = config

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      const statusCode = getStatusCode(error)
      if (statusCode === null || !RETRYABLE_STATUS_CODES.has(statusCode)) {
        throw error
      }

      if (attempt === maxAttempts) {
        break
      }

      let delay: number
      if (statusCode === 429 && error instanceof Error) {
        const retryAfter = extractRetryAfter(error)
        delay = retryAfter > 0 ? retryAfter * 1000 : jitteredDelay(baseDelay, attempt, maxDelay)
        onRateLimit?.({ retryAfter, endpoint, attempt })
      } else {
        delay = jitteredDelay(baseDelay, attempt, maxDelay)
      }

      await sleep(delay)
    }
  }

  const statusCode = getStatusCode(lastError) ?? 500
  const message = lastError instanceof Error ? lastError.message : `Request failed after ${maxAttempts} attempts`
  throw new ServerError(message, statusCode, maxAttempts)
}

function getStatusCode(error: unknown): number | null {
  if (error != null && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode: unknown }).statusCode
    if (typeof code === 'number') return code
  }
  return null
}

function extractRetryAfter(error: Error): number {
  if ('retryAfter' in error && typeof (error as { retryAfter: unknown }).retryAfter === 'number') {
    return (error as { retryAfter: number }).retryAfter
  }
  return 60
}
