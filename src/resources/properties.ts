import type { HttpClient, RequestOptions } from '../http/client'
import type { Property, PropertyList, PropertyTag } from '../models/property'
import type { CalendarDay, CalendarUpdate } from '../models/calendar'
import type { PaginatedResponse } from '../models/pagination'

export interface PropertyListParams {
  cursor?: string
  perPage?: number
  tags?: string[]
}

export class PropertiesResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: PropertyListParams = {}): Promise<PropertyList> {
    return this.http.get<PropertyList>('/v2/properties', params as RequestOptions['params'])
  }

  async get(id: string): Promise<Property> {
    return this.http.get<Property>(`/v2/properties/${id}`)
  }

  async listTags(id: string): Promise<PropertyTag[]> {
    const response = await this.http.get<{ data: PropertyTag[] }>(`/v2/properties/${id}/tags`)
    return response.data
  }

  async getCalendar(
    id: string,
    startDate: string,
    endDate: string,
  ): Promise<PaginatedResponse<CalendarDay>> {
    return this.http.get<PaginatedResponse<CalendarDay>>(`/v2/properties/${id}/calendar`, {
      startDate,
      endDate,
    })
  }

  async updateCalendar(id: string, updates: CalendarUpdate[]): Promise<void> {
    await this.http.put<void>(`/v2/properties/${id}/calendar`, { data: updates })
  }

  async *iter(params: Omit<PropertyListParams, 'cursor'> = {}): AsyncGenerator<Property> {
    let cursor: string | null = null
    do {
      const listParams: PropertyListParams = { ...params }
      if (cursor !== null) {
        listParams.cursor = cursor
      }
      const page = await this.list(listParams)
      for (const item of page.data) {
        yield item
      }
      cursor = page.meta.nextCursor
    } while (cursor !== null)
  }
}
