import type {
  ReservationIncludeField,
  ReservationListParams,
  ReservationStatus,
} from '../models/reservation'

/**
 * Fluent, immutable builder for `client.reservations.list` params.
 *
 * Every chainable method returns a new `ReservationFilter` — safe to branch
 * filters mid-construction without mutating shared state. Terminate the
 * chain with {@link toParams}.
 *
 * @example
 * ```ts
 * const params = new ReservationFilter()
 *   .checkinAfter('2026-01-01')
 *   .checkinBefore('2026-12-31')
 *   .status(['accepted', 'request'])
 *   .include('guest', 'properties')
 *   .perPage(50)
 *   .toParams()
 *
 * await client.reservations.list(params)
 * ```
 */
export class ReservationFilter {
  private readonly params: ReservationListParams

  constructor(params: ReservationListParams = {}) {
    this.params = params
  }

  /** Reservations with `arrivalDate >= date` (ISO `YYYY-MM-DD`). */
  checkinAfter(date: string): ReservationFilter {
    return new ReservationFilter({ ...this.params, startDate: date })
  }

  /** Reservations with `arrivalDate <= date` (ISO `YYYY-MM-DD`). */
  checkinBefore(date: string): ReservationFilter {
    return new ReservationFilter({ ...this.params, endDate: date })
  }

  /** Narrow to one or more statuses. */
  status(status: ReservationStatus | ReservationStatus[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, status })
  }

  /** Scope to specific property UUIDs. */
  properties(ids: string[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, properties: ids })
  }

  /**
   * Request one or more include fields. Pass as separate arguments:
   * `.include('guest', 'properties')`.
   */
  include(...fields: ReservationIncludeField[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, include: fields.join(',') })
  }

  perPage(n: number): ReservationFilter {
    return new ReservationFilter({ ...this.params, perPage: n })
  }

  /** Materialize the filter into a plain params object. */
  toParams(): ReservationListParams {
    return { ...this.params }
  }
}
