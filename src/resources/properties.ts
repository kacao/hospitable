import type { HttpClient, RequestOptions } from '../http/client'
import type { Property, PropertyList, PropertyTag } from '../models/property'
import { paginate } from '../http/paginate'

export interface PropertyListParams {
  page?: number
  perPage?: number
  tags?: string[]
}

export class PropertiesResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: PropertyListParams = {}): Promise<PropertyList> {
    return this.http.get<PropertyList>('/v2/properties', params as RequestOptions['params'])
  }

  async get(id: string): Promise<Property> {
    return this.http.get<Property>(`/v2/properties/${id}`)
  }

  async listTags(id: string): Promise<PropertyTag[]> {
    const response = await this.http.get<{ data: PropertyTag[] }>(`/v2/properties/${id}/tags`)
    return response.data
  }

  async *iter(params: Omit<PropertyListParams, 'page'> = {}): AsyncGenerator<Property> {
    yield* paginate<Property, PropertyListParams>(p => this.list(p), params)
  }
}
