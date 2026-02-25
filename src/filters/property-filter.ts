import type { PropertyListParams } from '../resources/properties'

export class PropertyFilter {
  private readonly params: PropertyListParams

  constructor(params: PropertyListParams = {}) {
    this.params = params
  }

  tags(tagIds: string[]): PropertyFilter {
    return new PropertyFilter({ ...this.params, tags: tagIds })
  }

  perPage(n: number): PropertyFilter {
    return new PropertyFilter({ ...this.params, perPage: n })
  }

  toParams(): PropertyListParams {
    return { ...this.params }
  }
}
