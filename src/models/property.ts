export type PropertyPlatform = 'airbnb' | 'vrbo' | 'booking_com' | 'direct' | string

export interface PropertyTag {
  id: string
  name: string
}

export interface Property {
  id: string
  name: string
  platform: PropertyPlatform
  platformId: string
  active: boolean
  timezone: string
  currency: string
  address: {
    street: string
    city: string
    state: string
    country: string
    zipCode: string
  }
  tags: PropertyTag[]
  createdAt: string
  updatedAt: string
}

export type PropertyList = import('./pagination').PaginatedResponse<Property>
