export interface PropertyAddress {
  number: string | null
  street: string
  city: string
  state: string
  postcode: string
  country: string
  countryName: string
  coordinates: {
    latitude: string
    longitude: string
  }
  display: string
}

export interface PropertyCapacity {
  max: number
  bedrooms: number
  beds: number
  bathrooms: number
}

export interface PropertyHouseRules {
  petsAllowed: boolean
  smokingAllowed: boolean
  eventsAllowed: boolean
}

export interface PropertyTag {
  id: string
  name: string
}

export interface Property {
  id: string
  name: string
  publicName: string
  picture: string | null
  address: PropertyAddress
  timezone: string
  listed: boolean
  currency: string
  summary: string | null
  description: string | null
  checkin: string
  checkout: string
  amenities: string[]
  capacity: PropertyCapacity
  propertyType: string
  roomType: string
  tags: PropertyTag[]
  houseRules: PropertyHouseRules
  calendarRestricted: boolean
}

export type PropertyList = import('./pagination').PaginatedResponse<Property>
