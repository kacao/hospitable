import type { HttpClient } from '../http/client'
import type { CalendarDay, CalendarUpdate } from '../models/calendar'
import type { PaginatedResponse } from '../models/pagination'

export class CalendarResource {
  constructor(private readonly http: HttpClient) {}

  async get(
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<PaginatedResponse<CalendarDay>> {
    return this.http.get<PaginatedResponse<CalendarDay>>(
      `/v2/properties/${propertyId}/calendar`,
      { startDate, endDate },
    )
  }

  async update(propertyId: string, updates: CalendarUpdate[]): Promise<void> {
    await this.http.put<void>(`/v2/properties/${propertyId}/calendar`, { data: updates })
  }

  async block(
    propertyId: string,
    startDate: string,
    endDate: string,
    reason?: string,
  ): Promise<void> {
    const body: Record<string, string> = { startDate, endDate }
    if (reason !== undefined) body['reason'] = reason
    await this.http.post<void>(`/v2/properties/${propertyId}/calendar/block`, body)
  }

  async unblock(propertyId: string, startDate: string, endDate: string): Promise<void> {
    await this.http.post<void>(`/v2/properties/${propertyId}/calendar/unblock`, {
      startDate,
      endDate,
    })
  }
}
