import type { PropertyListParams } from '../resources/properties'
import type { PropertyIncludeField } from '../models/property'

/**
 * Fluent, immutable builder for `client.properties.list` params.
 *
 * @example
 * ```ts
 * const params = new PropertyFilter()
 *   .tags(['tag-uuid-1', 'tag-uuid-2'])
 *   .include('user', 'listings')
 *   .perPage(100)
 *   .toParams()
 *
 * await client.properties.list(params)
 * ```
 */
export class PropertyFilter {
  private readonly params: PropertyListParams

  constructor(params: PropertyListParams = {}) {
    this.params = params
  }

  /** Narrow to properties tagged with any of the given tag UUIDs. */
  tags(tagIds: string[]): PropertyFilter {
    return new PropertyFilter({ ...this.params, tags: tagIds })
  }

  /**
   * Request one or more include fields. Pass as separate arguments:
   * `.include('user', 'listings', 'details')`. Accepted values are
   * `'user'`, `'listings'`, `'details'`, `'bookings'` — unknown values
   * are silently ignored by the API, so TypeScript narrowing via
   * {@link PropertyIncludeField} is the only fail-fast check.
   */
  include(...fields: PropertyIncludeField[]): PropertyFilter {
    return new PropertyFilter({ ...this.params, include: fields.join(',') })
  }

  perPage(n: number): PropertyFilter {
    return new PropertyFilter({ ...this.params, perPage: n })
  }

  /** Materialize the filter into a plain params object. */
  toParams(): PropertyListParams {
    return { ...this.params }
  }
}
