import type { HttpClient } from '../http/client'
import type {
  Reservation,
  ReservationList,
  ReservationListParams,
} from '../models/reservation'

export class ReservationsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: ReservationListParams = {}): Promise<ReservationList> {
    const normalized: Record<string, string | number | boolean | string[] | undefined> = {
      ...params,
      properties: params.properties,
      status: Array.isArray(params.status) ? params.status.join(',') : params.status,
    }
    return this.http.get<ReservationList>('/v2/reservations', normalized)
  }

  async get(id: string, include?: string): Promise<Reservation> {
    return this.http.get<Reservation>(`/v2/reservations/${id}`, include ? { include } : undefined)
  }

  async getUpcoming(
    propertyIds: string[],
    options: { include?: string } = {},
  ): Promise<ReservationList> {
    const today = new Date().toISOString().split('T')[0]!
    return this.list({
      properties: propertyIds,
      startDate: today,
      status: 'confirmed',
      include: options.include ?? 'guest,properties',
    })
  }

  async *iter(params: Omit<ReservationListParams, 'cursor'> = {}): AsyncGenerator<Reservation> {
    let cursor: string | undefined
    do {
      const pageParams: ReservationListParams = { ...params }
      if (cursor !== undefined) pageParams.cursor = cursor
      const page = await this.list(pageParams)
      for (const item of page.data) {
        yield item
      }
      cursor = page.meta.nextCursor ?? undefined
    } while (cursor !== undefined)
  }
}
