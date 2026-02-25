export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    nextCursor: string | null
    total: number
    perPage: number
  }
}
