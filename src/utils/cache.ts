export interface CacheConfig {
  enabled?: boolean
  ttl?: number
  maxSize?: number
}

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>()
  private readonly ttl: number
  private readonly maxSize: number

  constructor(config: CacheConfig = {}) {
    this.ttl = config.ttl ?? 60_000
    this.maxSize = config.maxSize ?? 100
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.value
  }

  set(key: string, value: T): void {
    this.store.delete(key)
    if (this.store.size >= this.maxSize) {
      const now = Date.now()
      for (const [k, e] of this.store) {
        if (now > e.expiresAt) this.store.delete(k)
      }
    }
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttl })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  delete(key: string): boolean {
    return this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}

export function cacheKey(prefix: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return prefix
  const sorted = Object.keys(params).sort().reduce<Record<string, unknown>>((acc, k) => {
    if (params[k] !== undefined) acc[k] = params[k]
    return acc
  }, {})
  return `${prefix}:${JSON.stringify(sorted)}`
}
