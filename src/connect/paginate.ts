import type { ConnectPaginatedResponse } from './models'

export interface ConnectPageFetcher<T, P extends { page?: number; perPage?: number }> {
  (params: P): Promise<ConnectPaginatedResponse<T>>
}

/**
 * Page-driver for Connect list endpoints. Terminates when the API
 * returns a page with an empty `data` array or null `links.next` —
 * Connect's `meta.last_page` is only sometimes present, so we rely on
 * the resource-level link header + empty-page signal which every list
 * endpoint honors.
 */
export async function* paginateConnect<T, P extends { page?: number; perPage?: number }>(
  fetcher: ConnectPageFetcher<T, P>,
  params: Omit<P, 'page'>,
): AsyncGenerator<T> {
  let page = 1
  while (true) {
    const result = await fetcher({ ...params, page } as P)
    for (const item of result.data) {
      yield item
    }
    if (result.links.next === null || result.data.length === 0) return
    const lastPage = result.meta.lastPage
    if (typeof lastPage === 'number' && page >= lastPage) return
    page++
  }
}
