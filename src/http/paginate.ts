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

export async function collectAll<T, P extends { page?: number; perPage?: number }>(
  fetcher: PageFetcher<T, P>,
  params: Omit<P, 'page'>,
): Promise<T[]> {
  const results: T[] = []
  for await (const item of paginate(fetcher, params)) {
    results.push(item)
  }
  return results
}
