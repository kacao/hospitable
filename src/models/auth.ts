export interface ClientConfig {
  token?: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  baseURL?: string
  onRateLimit?: (info: RateLimitInfo) => void
  debug?: boolean
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface RateLimitInfo {
  retryAfter: number
  endpoint: string
  attempt: number
}
