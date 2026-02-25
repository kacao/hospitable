import { VERSION } from '../index'
import { withRetry, type RetryConfig } from './retry'

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
  debug?: boolean
  retryConfig?: RetryConfig
}

// NOTE: We inline error creation here to avoid circular dep — the real errors
// module will be implemented in a sibling PR. This file uses a simple inline
// error class that matches the final interface so it can be swapped in later.
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
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

export class HttpClient {
  constructor(private readonly config: HttpClientConfig) {}

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
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        })

        const requestId = response.headers.get('x-request-id') ?? undefined

        if (!response.ok) {
          let errorBody: Record<string, unknown> = {}
          try {
            errorBody = (await response.json()) as Record<string, unknown>
          } catch {
            // ignore parse errors
          }
          const message = (errorBody['message'] as string | undefined) ?? `HTTP ${response.status}`
          throw new HttpError(response.status, message, requestId, errorBody)
        }

        if (response.status === 204) {
          return undefined as T
        }

        return response.json() as Promise<T>
      },
      url,
      this.config.retryConfig,
    )
  }

  get<T>(path: string, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>(path, { method: 'GET', params })
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
