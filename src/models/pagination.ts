export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    currentPage: number
    lastPage: number
    perPage: number
    total: number
  }
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
}
