export interface PropertyAddress {
  number: string | null
  street: string
  city: string
  state: string
  postcode: string
  country: string
  /**
   * Full country name (e.g. "United States"). The API may return `null`
   * when country metadata is not resolved — don't assume this is populated.
   */
  countryName: string | null
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

/**
 * Individual bed entry within a {@link PropertyRoomDetail}.
 *
 * `type` values seen in the wild: `king_bed`, `queen_bed`, `double_bed`,
 * `single_bed`, `sofa_bed`, `crib`. Kept as open string union.
 */
export interface PropertyRoomBed {
  type: string
  quantity: number
}

/**
 * Structured room/bed layout returned on the property object under
 * `room_details`. Non-sleeping rooms (kitchen, living_room, backyard)
 * appear with an empty `beds` array.
 */
export interface PropertyRoomDetail {
  /**
   * Room type. Values seen: `bedroom`, `full_bathroom`, `half_bathroom`,
   * `kitchen`, `living_room`, `dining_room`, `backyard`, `patio`. Open
   * string union — new room types may appear.
   */
  type: string
  beds: PropertyRoomBed[]
}

/**
 * Tag object returned by `GET /v2/properties/{id}/tags` — the
 * organization-level tag registry, distinct from the free-text tags that
 * appear inline on the property object (see {@link Property.tags}).
 */
export interface PropertyTag {
  id: string
  name: string
}

/**
 * Parent/child relationship metadata for listings that are part of a
 * multi-unit or sub-unit setup. `null` for standalone listings. Exact
 * shape varies by platform — kept as `unknown` so agents narrow it.
 */
export type PropertyParentChild = unknown | null

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
  /** Local check-in time as `HH:MM`. */
  checkin: string
  /** Local check-out time as `HH:MM`. */
  checkout: string
  amenities: string[]
  capacity: PropertyCapacity
  propertyType: string
  roomType: string
  /**
   * Free-text tags attached to the property (e.g. `"Anaheim"`,
   * `"shorterm"`). Distinct from {@link PropertyTag} objects returned by
   * `PropertiesResource.listTags()`, which are structured org-level tags.
   */
  tags: string[]
  houseRules: PropertyHouseRules
  /** Structured room layout. Not all properties populate this. */
  roomDetails: PropertyRoomDetail[]
  calendarRestricted: boolean
  /** Parent/child linkage for multi-unit listings. `null` for standalone. */
  parentChild: PropertyParentChild
}

export type PropertyList = import('./pagination').PaginatedResponse<Property>

/**
 * An image attached to a property.
 *
 * @see GET https://public.api.hospitable.com/v2/properties/{id}/images
 */
export interface PropertyImage {
  url: string
  thumbnailUrl: string
  /** Caption text. May be empty string. */
  caption: string
  /** Display order (0-indexed). */
  order: number
  /** ISO 8601 timestamp. */
  lastUpdatedAt: string
}

/**
 * Parameters for `GET /v2/properties/search` — availability search.
 *
 * All three fields are required by the API. The endpoint returns properties
 * that are available for the given window and party size.
 */
export interface PropertySearchParams {
  /** ISO `YYYY-MM-DD` — desired check-in date. */
  startDate: string
  /** ISO `YYYY-MM-DD` — desired check-out date. */
  endDate: string
  /** Number of adult guests. */
  adults: number
  /** Number of children. */
  children?: number
  /** Number of infants. */
  infants?: number
  /** Number of pets. */
  pets?: number
  page?: number
  perPage?: number
}
