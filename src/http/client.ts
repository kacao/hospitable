import { VERSION } from '../index'
import { withRetry, type RetryConfig } from './retry'
import { sanitize } from '../utils/sanitize'
import { camelToSnake, deepSnakeToCamel, deepCamelToSnake } from '../utils/case'
import { createErrorFromResponse, type HospitableError } from '../errors'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  params?: Record<string, string | number | boolean | string[] | undefined>
  body?: unknown
  headers?: Record<string, string>
}

export interface HttpClientConfig {
  baseURL: string
  getAuthHeader: () => Promise<string>
  onUnauthorized?: () => Promise<void>
  debug?: boolean
  retryConfig?: RetryConfig
}

/**
 * Legacy HTTP error class.
 *
 * @deprecated Exported only for backward compatibility with code that
 * imported `HttpError` directly. New code should catch
 * {@link HospitableError} and its subclasses (`NotFoundError`,
 * `AuthenticationError`, `ValidationError`, etc.) — `HttpClient` now throws
 * those at runtime.
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly requestId: string | undefined,
    readonly body: Record<string, unknown>,
    readonly attempts: number = 1,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

function buildURL(base: string, path: string, params?: RequestOptions['params']): string {
  const url = new URL(path, base)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue
      const snakeKey = camelToSnake(key)
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(`${snakeKey}[]`, v))
      } else {
        url.searchParams.set(snakeKey, String(value))
      }
    }
  }
  return url.toString()
}

async function readErrorBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const raw = await response.json()
    return deepSnakeToCamel(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function errorFromResponse(
  response: Response,
  body: Record<string, unknown>,
): HospitableError {
  const requestId = response.headers.get('x-request-id') ?? undefined
  // RFC 6585 `Retry-After` — Hospitable (like most APIs) returns rate-limit
  // backoff guidance via this header, not a JSON body field. Lift it here so
  // `RateLimitError.retryAfter` reflects the server's actual wait request.
  const retryAfterHeader = response.headers.get('Retry-After')
  const retryAfterOverride =
    retryAfterHeader !== null && /^\d+$/.test(retryAfterHeader)
      ? parseInt(retryAfterHeader, 10)
      : undefined
  // Fall back to a status-derived message when the body omits one so the
  // thrown error always carries something more useful than "undefined".
  if (body['message'] === undefined) {
    body = { ...body, message: `HTTP ${response.status}` }
  }
  return createErrorFromResponse(response.status, body, requestId, 1, retryAfterOverride)
}

export class HttpClient {
  constructor(private readonly config: HttpClientConfig) {}

  private async parseResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T
    return response.json().then(deepSnakeToCamel) as Promise<T>
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', params, body, headers: extraHeaders = {} } = options
    const url = buildURL(this.config.baseURL, path, params)

    return withRetry(
      async () => {
        const authHeader = await this.config.getAuthHeader()

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
          'User-Agent': `hospitable-ts/${VERSION}`,
          ...extraHeaders,
        }

        if (this.config.debug) {
          console.debug(`[hospitable] ${method} ${url}`)
          if (body !== undefined) {
            console.debug('[hospitable] body:', sanitize(body))
          }
        }

        const response = await fetch(url, {
          method,
          headers,
          ...(body !== undefined ? { body: JSON.stringify(deepCamelToSnake(body)) } : {}),
        })

        if (!response.ok) {
          const errorBody = await readErrorBody(response)
          if (this.config.debug) {
            console.debug('[hospitable] error body:', sanitize(errorBody))
          }
          if (response.status === 401 && this.config.onUnauthorized) {
            await this.config.onUnauthorized()
            const freshAuth = await this.config.getAuthHeader()
            const retryResponse = await fetch(url, {
              method,
              headers: { ...headers, Authorization: freshAuth },
              ...(body !== undefined ? { body: JSON.stringify(deepCamelToSnake(body)) } : {}),
            })
            if (retryResponse.ok) {
              return this.parseResponse<T>(retryResponse)
            }
            throw errorFromResponse(retryResponse, await readErrorBody(retryResponse))
          }
          throw errorFromResponse(response, errorBody)
        }

        return this.parseResponse<T>(response)
      },
      url,
      this.config.retryConfig,
    )
  }

  get<T>(path: string, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>(path, { method: 'GET', ...(params !== undefined ? { params } : {}) })
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body })
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }
}
