import type { PropertyListParams } from '../resources/properties'

/**
 * Fluent, immutable builder for `client.properties.list` params.
 *
 * @example
 * ```ts
 * const params = new PropertyFilter()
 *   .tags(['tag-uuid-1', 'tag-uuid-2'])
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

  perPage(n: number): PropertyFilter {
    return new PropertyFilter({ ...this.params, perPage: n })
  }

  /** Materialize the filter into a plain params object. */
  toParams(): PropertyListParams {
    return { ...this.params }
  }
}
