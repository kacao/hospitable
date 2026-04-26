import type { HttpClient } from '../http/client'
import type { CalendarData, CalendarUpdate } from '../models/calendar'

/**
 * Resource for reading and mutating per-property calendar state: day
 * availability, nightly price, minimum stay, and owner blocks.
 *
 * Dates are always ISO `YYYY-MM-DD`. `update` and `block` are **additive** —
 * Hospitable merges the payload with existing calendar state rather than
 * replacing it.
 *
 * @see https://developer.hospitable.com/docs/public-api-docs/w7lb6cwd1dvx6-calendar-resource
 */
export class CalendarResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch calendar days for a property in `[startDate, endDate]` inclusive.
   *
   * @see GET https://public.api.hospitable.com/v2/properties/{id}/calendar
   */
  async get(
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<CalendarData> {
    const response = await this.http.get<{ data: CalendarData }>(
      `/v2/properties/${encodeURIComponent(propertyId)}/calendar`,
      { startDate, endDate },
    )
    return response.data
  }

  /**
   * Apply a batch of per-day calendar updates (price, availability, minStay,
   * check-in/out restrictions, notes). Merges additively — only the fields
   * provided on each `CalendarUpdate` entry are modified.
   *
   * `options.note` sets a top-level note applied to every date in `updates`
   * that doesn't define its own `note`. Pass `null` to clear. Max 512 chars.
   *
   * @see PUT https://public.api.hospitable.com/v2/properties/{id}/calendar
   */
  async update(
    propertyId: string,
    updates: CalendarUpdate[],
    options: { note?: string | null } = {},
  ): Promise<void> {
    const body: { note?: string | null; dates: CalendarUpdate[] } = { dates: updates }
    if (options.note !== undefined) body.note = options.note
    await this.http.put<void>(
      `/v2/properties/${encodeURIComponent(propertyId)}/calendar`,
      body,
    )
  }

  /**
   * Block a date range (e.g. owner stay, maintenance).
   *
   * @see POST https://public.api.hospitable.com/v2/properties/{id}/calendar/block
   */
  async block(
    propertyId: string,
    startDate: string,
    endDate: string,
    reason?: string,
  ): Promise<void> {
    const body: Record<string, string> = { startDate, endDate }
    if (reason !== undefined) body['reason'] = reason
    await this.http.post<void>(
      `/v2/properties/${encodeURIComponent(propertyId)}/calendar/block`,
      body,
    )
  }

  /**
   * Remove a previously placed block on a date range.
   *
   * @see POST https://public.api.hospitable.com/v2/properties/{id}/calendar/unblock
   */
  async unblock(propertyId: string, startDate: string, endDate: string): Promise<void> {
    await this.http.post<void>(
      `/v2/properties/${encodeURIComponent(propertyId)}/calendar/unblock`,
      {
        startDate,
        endDate,
      },
    )
  }
}
