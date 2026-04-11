import type {
  ReservationDateQuery,
  ReservationIncludeField,
  ReservationListParams,
  ReservationStatus,
} from '../models/reservation'
import { ConfigurationError } from '../errors'

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
 *   .properties([propertyId])                 // required by the API
 *   .checkinAfter('2026-01-01')
 *   .checkinBefore('2026-12-31')
 *   .dateQuery('checkout')                    // optional — defaults to checkin
 *   .status(['accepted', 'request'])
 *   .include('guest', 'properties', 'review')
 *   .perPage(50)
 *   .toParams()
 *
 * await client.reservations.list(params)
 * ```
 */
export class ReservationFilter {
  private readonly params: Partial<ReservationListParams>

  constructor(params: Partial<ReservationListParams> = {}) {
    this.params = params
  }

  /** Reservations with date >= this (ISO `YYYY-MM-DD`), on field chosen by {@link dateQuery}. */
  checkinAfter(date: string): ReservationFilter {
    return new ReservationFilter({ ...this.params, startDate: date })
  }

  /** Reservations with date <= this (ISO `YYYY-MM-DD`), on field chosen by {@link dateQuery}. */
  checkinBefore(date: string): ReservationFilter {
    return new ReservationFilter({ ...this.params, endDate: date })
  }

  /**
   * Choose which date field `checkinAfter`/`checkinBefore` filter against.
   * Defaults to `'checkin'` on the API side. Set to `'checkout'` to find
   * guests currently in-house or departing in a window.
   */
  dateQuery(q: ReservationDateQuery): ReservationFilter {
    return new ReservationFilter({ ...this.params, dateQuery: q })
  }

  /**
   * Only reservations whose last-message timestamp is >= this value.
   * Format: `YYYY-MM-DD HH:MM:SS` (space-separated — NOT ISO 8601).
   */
  lastMessageAt(timestamp: string): ReservationFilter {
    return new ReservationFilter({ ...this.params, lastMessageAt: timestamp })
  }

  /** Narrow to one or more statuses. */
  status(status: ReservationStatus | ReservationStatus[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, status })
  }

  /** Scope to specific property UUIDs. **Required by the API.** */
  properties(ids: string[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, properties: ids })
  }

  /**
   * Request one or more include fields. Pass as separate arguments:
   * `.include('guest', 'properties', 'review')`.
   */
  include(...fields: ReservationIncludeField[]): ReservationFilter {
    return new ReservationFilter({ ...this.params, include: fields.join(',') })
  }

  perPage(n: number): ReservationFilter {
    return new ReservationFilter({ ...this.params, perPage: n })
  }

  /**
   * Materialize the filter into a plain params object suitable for
   * `client.reservations.list()`.
   *
   * @throws {ConfigurationError} when `properties` has not been supplied
   */
  toParams(): ReservationListParams {
    if (!this.params.properties || this.params.properties.length === 0) {
      throw new ConfigurationError(
        'ReservationFilter.toParams: call .properties([...ids]) first — ' +
          'the Hospitable API rejects reservation queries without this filter.',
      )
    }
    return { ...this.params } as ReservationListParams
  }
}
