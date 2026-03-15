import type { HttpClient, RequestOptions } from '../http/client'
import type {
  OrphanDate,
  Reservation,
  ReservationList,
  ReservationListParams,
} from '../models/reservation'
import { paginate, collectAll } from '../http/paginate'

function diffDays(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]!
}

const CONCURRENT_BATCH_SIZE = 5

export class ReservationsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: ReservationListParams = {}): Promise<ReservationList> {
    const { properties, startDate, endDate, status, include, perPage, page } = params
    return this.http.get<ReservationList>('/v2/reservations', {
      page,
      properties,
      startDate,
      endDate,
      status: Array.isArray(status) ? status.join(',') : status,
      include,
      perPage,
    } as RequestOptions['params'])
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
      status: 'accepted',
      include: options.include ?? 'guest,properties',
    })
  }

  async getOrphanDates(
    startDate: string,
    endDate: string,
    maxOrphanDays = 2,
    properties?: string[],
  ): Promise<OrphanDate[]> {
    const fetchStart = shiftDate(startDate, -maxOrphanDays)

    const reservations: Array<Reservation & { propertyId: string }> = []

    if (properties && properties.length > 0) {
      for (let i = 0; i < properties.length; i += CONCURRENT_BATCH_SIZE) {
        const batch = properties.slice(i, i + CONCURRENT_BATCH_SIZE)
        const results = await Promise.all(
          batch.map(async (propId) => {
            const items = await collectAll<Reservation, ReservationListParams>(
              p => this.list(p),
              { startDate: fetchStart, endDate, status: ['accepted', 'confirmed'], properties: [propId] },
            )
            return items.map(res => ({ ...res, propertyId: propId }))
          })
        )
        for (const items of results) {
          reservations.push(...items)
        }
      }
    } else {
      for await (const res of this.iter({
        startDate: fetchStart,
        endDate,
        status: ['accepted', 'confirmed'],
      })) {
        if (res.propertyId !== undefined) {
          reservations.push(res as Reservation & { propertyId: string })
        }
      }
    }

    const byProperty = new Map<string, Array<Reservation & { propertyId: string }>>()
    for (const res of reservations) {
      const list = byProperty.get(res.propertyId) ?? []
      list.push(res)
      byProperty.set(res.propertyId, list)
    }

    const orphans: OrphanDate[] = []

    for (const [propertyId, list] of byProperty) {
      list.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))

      for (let i = 0; i + 1 < list.length; i++) {
        const before = list[i]!
        const after = list[i + 1]!
        const beforeCheckout = before.departureDate.slice(0, 10)
        const afterCheckin = after.arrivalDate.slice(0, 10)
        const gapDays = diffDays(beforeCheckout, afterCheckin)

        if (
          gapDays >= 1 &&
          gapDays <= maxOrphanDays &&
          beforeCheckout <= endDate &&
          afterCheckin > startDate
        ) {
          orphans.push({ count: gapDays, propertyId, reservationBefore: before, reservationAfter: after })
        }
      }
    }

    return orphans
  }

  async *iter(params: Omit<ReservationListParams, 'page'> = {}): AsyncGenerator<Reservation> {
    yield* paginate<Reservation, ReservationListParams>(p => this.list(p), params)
  }
}
