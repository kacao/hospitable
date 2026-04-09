import type { PaginatedResponse } from '../models/pagination'

export interface PageFetcher<T, P extends { page?: number; perPage?: number }> {
  (params: P): Promise<PaginatedResponse<T>>
}

export async function* paginate<T, P extends { page?: number; perPage?: number }>(
  fetcher: PageFetcher<T, P>,
  params: Omit<P, 'page'>,
): AsyncGenerator<T> {
  let page = 1
  let lastPage = 1
  do {
    const result = await fetcher({ ...params, page } as P)
    for (const item of result.data) {
      yield item
    }
    lastPage = result.meta.lastPage
    page++
  } while (page <= lastPage)
}

/**
 * Drain every item from a paginated source into an array.
 *
 * Two forms are supported:
 *
 * 1. **Iterable form** — the idiomatic shape for SDK consumers:
 *    ```ts
 *    const all = await collectAll(client.reservations.iter({ startDate: '2026-01-01' }))
 *    ```
 *
 * 2. **Fetcher form** — used when driving pagination against a raw
 *    `PageFetcher` without a resource class in scope:
 *    ```ts
 *    const all = await collectAll(params => http.get('/v2/things', params), { perPage: 50 })
 *    ```
 *
 * @remarks Both forms eagerly buffer the entire result set in memory. For
 * large streams (>10k items), prefer iterating directly with `for await`
 * and processing items as they arrive.
 */
export function collectAll<T>(iterable: AsyncIterable<T>): Promise<T[]>
export function collectAll<T, P extends { page?: number; perPage?: number }>(
  fetcher: PageFetcher<T, P>,
  params: Omit<P, 'page'>,
): Promise<T[]>
export async function collectAll<T, P extends { page?: number; perPage?: number }>(
  source: AsyncIterable<T> | PageFetcher<T, P>,
  params?: Omit<P, 'page'>,
): Promise<T[]> {
  const results: T[] = []
  const iterable: AsyncIterable<T> =
    typeof source === 'function'
      ? paginate(source, params ?? ({} as Omit<P, 'page'>))
      : source
  for await (const item of iterable) {
    results.push(item)
  }
  return results
}
