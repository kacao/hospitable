declare const process: { env: Record<string, string | undefined> }

export interface TokenManagerConfig {
  token?: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  baseURL: string
}

interface OAuthTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export class TokenManager {
  private accessToken: string | undefined
  private refreshToken: string | undefined
  private expiresAt: number = 0
  private refreshPromise: Promise<void> | null = null

  constructor(private readonly config: TokenManagerConfig) {
    if (config.token && !config.refreshToken && !config.clientId) {
      this.accessToken = config.token
      this.expiresAt = Infinity
    } else if (config.token) {
      this.accessToken = config.token
      this.refreshToken = config.refreshToken
      this.expiresAt = Date.now() + 60_000
    } else {
      const envPat = process.env['HOSPITABLE_PAT']
      if (envPat) {
        this.accessToken = envPat
        this.expiresAt = Infinity
      }
    }
  }

  async getAuthHeader(): Promise<string> {
    if (this.needsRefresh()) {
      await this.ensureRefreshed()
    }
    if (!this.accessToken) {
      throw new Error('No access token available. Provide token or clientId+clientSecret.')
    }
    return `Bearer ${this.accessToken}`
  }

  private needsRefresh(): boolean {
    if (this.expiresAt === Infinity) return false
    return Date.now() >= this.expiresAt - 60_000
  }

  private async ensureRefreshed(): Promise<void> {
    if (this.refreshPromise) {
      await this.refreshPromise
      return
    }
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null
    })
    await this.refreshPromise
  }

  private async doRefresh(): Promise<void> {
    const { clientId, clientSecret, baseURL } = this.config
    if (!clientId || !clientSecret) {
      throw new Error('Cannot refresh token: clientId and clientSecret are required')
    }

    const body = this.refreshToken
      ? new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        })
      : new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        })

    const response = await fetch(`${baseURL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Token refresh failed (${response.status}): ${text}`)
    }

    const data = (await response.json()) as OAuthTokenResponse
    this.accessToken = data.access_token
    if (data.refresh_token) this.refreshToken = data.refresh_token
    this.expiresAt = Date.now() + data.expires_in * 1000
  }

  async handleUnauthorized(): Promise<void> {
    this.expiresAt = 0
    await this.ensureRefreshed()
  }
}
