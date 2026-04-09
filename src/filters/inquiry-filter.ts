import type { InquiryIncludeField, InquiryListParams } from '../models/inquiry'
import { ConfigurationError } from '../errors'

/**
 * Fluent builder for inquiry list params.
 *
 * Immutable — every method returns a new `InquiryFilter`. Build up the filter then
 * call {@link toParams} or pass directly to `client.inquiries.list(filter.toParams())`.
 *
 * The underlying API requires a non-empty `properties` filter;
 * {@link toParams} throws {@link ConfigurationError} if none was supplied.
 *
 * @example
 * ```ts
 * const params = new InquiryFilter()
 *   .properties(['prop-uuid'])
 *   .include('guest', 'properties')
 *   .lastMessageAfter('2026-01-01T00:00:00Z')
 *   .perPage(50)
 *   .toParams()
 *
 * await client.inquiries.list(params)
 * ```
 */
export class InquiryFilter {
  private readonly params: Partial<InquiryListParams>

  constructor(params: Partial<InquiryListParams> = {}) {
    this.params = params
  }

  properties(ids: string[]): InquiryFilter {
    return new InquiryFilter({ ...this.params, properties: ids })
  }

  include(...fields: InquiryIncludeField[]): InquiryFilter {
    return new InquiryFilter({ ...this.params, include: fields.join(',') })
  }

  lastMessageAfter(datetime: string): InquiryFilter {
    return new InquiryFilter({ ...this.params, lastMessageAt: datetime })
  }

  page(n: number): InquiryFilter {
    return new InquiryFilter({ ...this.params, page: n })
  }

  perPage(n: number): InquiryFilter {
    return new InquiryFilter({ ...this.params, perPage: n })
  }

  /**
   * Materialize the filter.
   *
   * @throws {ConfigurationError} if `.properties()` was never called or was
   * called with an empty array — the `/v2/inquiries` endpoint requires a
   * non-empty set of property UUIDs.
   */
  toParams(): InquiryListParams {
    if (!this.params.properties || this.params.properties.length === 0) {
      throw new ConfigurationError(
        'InquiryFilter: `properties` is required. Call .properties([uuid, ...]) before .toParams().',
      )
    }
    return { ...this.params, properties: this.params.properties }
  }
}
