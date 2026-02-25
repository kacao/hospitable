import type { PaginatedResponse } from '../models/pagination'

export interface PageFetcher<T, P extends { cursor?: string; perPage?: number }> {
  (params: P): Promise<PaginatedResponse<T>>
}

export async function* paginate<T, P extends { cursor?: string; perPage?: number }>(
  fetcher: PageFetcher<T, P>,
  params: Omit<P, 'cursor'>,
  perPage = 100,
): AsyncGenerator<T> {
  let cursor: string | null = null

  do {
    const page = await fetcher({
      ...params,
      cursor: cursor ?? undefined,
      perPage,
    } as P)

    for (const item of page.data) {
      yield item
    }

    cursor = page.meta.nextCursor
  } while (cursor !== null)
}

export async function collectAll<T, P extends { cursor?: string; perPage?: number }>(
  fetcher: PageFetcher<T, P>,
  params: Omit<P, 'cursor'>,
  perPage = 100,
): Promise<T[]> {
  const results: T[] = []
  for await (const item of paginate(fetcher, params, perPage)) {
    results.push(item)
  }
  return results
}
