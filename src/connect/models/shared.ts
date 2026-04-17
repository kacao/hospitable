/**
 * Financial amount object. `amount` is an integer in the minor unit of
 * `currency` (e.g. cents for USD, öre for SEK). `formatted` is the
 * server-rendered display string. `label` describes the line item when
 * the financial appears in an array (taxes, fees, discounts).
 */
export interface Financial {
  amount: number
  formatted: string
  currency: string
  label: string | null
}

/**
 * OTA platform identifier on Connect entities. Currently only `'airbnb'`
 * is returned for connected channels, but kept as an open string union
 * to tolerate future additions without breaking the type.
 */
export type ConnectPlatform = 'airbnb' | (string & {})

/**
 * Pagination `links` object on a Connect paginated list. All members
 * except `first` may be `null` depending on current position.
 */
export interface ConnectPaginationLinks {
  first: string
  last: string | null
  prev: string | null
  next: string | null
}

/**
 * Pagination `meta` object on a Connect paginated list.
 *
 * Note: Connect's `meta` shape differs from the Public API —
 * `current_page`, `from`, `to`, `path`, `per_page` and (sometimes)
 * `total`. The Public SDK's shape (`currentPage`, `lastPage`, `perPage`,
 * `total`) is not one-to-one compatible, so this is a separate type.
 */
export interface ConnectPaginationMeta {
  currentPage: number
  from: number | null
  to: number | null
  path: string
  perPage: number
  total?: number
  lastPage?: number
}

/**
 * Standard Connect list envelope. `links` and `meta` are always present;
 * `data` is the resource array.
 */
export interface ConnectPaginatedResponse<T> {
  data: T[]
  links: ConnectPaginationLinks
  meta: ConnectPaginationMeta
}
