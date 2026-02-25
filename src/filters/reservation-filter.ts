import type { ReservationListParams, ReservationStatus } from '../models/reservation'

export class ReservationFilter {
  private readonly params: ReservationListParams

  constructor(params: ReservationListParams = {}) {
    this.params = params
  }

  checkinAfter(date: string): ReservationFilter {
    return new ReservationFilter({ ...this.params, startDate: date })
  }

  checkinBefore(date: string): ReservationFilter {
    return new ReservationFilter({ ...this.params, endDate: date })
  }

  status(status: ReservationStatus | ReservationStatus[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, status })
  }

  properties(ids: string[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, properties: ids })
  }

  include(...fields: string[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, include: fields.join(',') })
  }

  perPage(n: number): ReservationFilter {
    return new ReservationFilter({ ...this.params, perPage: n })
  }

  toParams(): ReservationListParams {
    return { ...this.params }
  }
}
