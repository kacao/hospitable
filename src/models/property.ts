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

/**
 * Include fields accepted by `GET /v2/properties` and `GET /v2/properties/{id}`.
 *
 * Empirically verified against the live API on 2026-04-11. Unknown
 * includes are silently ignored by the server (return 200 with no extra
 * fields) — passing an invalid value won't error.
 *
 * @see https://developer.hospitable.com/docs/public-api-docs/qc4x36uhxinx3-get-properties
 */
export type PropertyIncludeField = 'user' | 'listings' | 'details' | 'bookings'

/**
 * Host/account info returned when `include=user` is requested on a
 * property. Same shape as the nested `user` on a reservation — minimal
 * identity (no billing, no business profile). For the full profile call
 * `client.user.get()` separately.
 */
export interface PropertyUser {
  id: string
  email: string
  name: string
  profilePicture: string | null
}

/**
 * Co-host entry on a property listing — one of potentially multiple
 * people with admin access to a single channel. Empty array for listings
 * with no co-hosts.
 */
export interface PropertyListingCoHost {
  userId: string
  name: string
  channelName: string
}

/**
 * A single platform listing for a property — one per booking channel
 * (airbnb, vrbo, booking_com, direct, manual, gvr, etc.). Returned as an
 * array when `include=listings` is requested.
 */
export interface PropertyListing {
  /** Booking platform, e.g. `'airbnb'`, `'vrbo'`, `'direct'`. */
  platform: string
  /** Platform's listing id for this property on this channel. */
  platformId: string
  /** Platform's user id for the host on this listing. */
  platformUserId: string | null
  /** Host's profile picture URL on the platform, if any. */
  platformPicture: string | null
  /** Display name on the platform, if any. */
  platformName: string | null
  /** Host email on the platform, if any. */
  platformEmail: string | null
  /** Co-hosts with access to this listing. */
  coHosts: PropertyListingCoHost[]
}

/**
 * Host-operational details about a property — returned when
 * `include=details` is requested. These are the fields the host populates
 * in Hospitable to answer common guest questions and feed automated
 * responses.
 *
 * **`wifiPassword` is NOT redacted** by `sanitize()`. It's semi-public by
 * design — hosts share it with every guest — and agents fetching this
 * field to include in a check-in message need to see the real value in
 * debug output. The SDK's `SAFE_OVERRIDES` allowlist explicitly excludes
 * `wifiPassword`/`wifi_password` from the broad `/password/i` match.
 */
export interface PropertyDetails {
  /** Additional house rules beyond the structured `houseRules` object. */
  additionalRules: string | null
  /** Directions and transit info. */
  gettingAround: string | null
  /** How guests get in (lockbox, keypad, greeter, etc.). */
  guestAccess: string | null
  /** House manual / operations guide. */
  houseManual: string | null
  /** Neighborhood / area description. */
  neighborhoodDescription: string | null
  /** Free-form "other details" field. */
  otherDetails: string | null
  /** Short overview of the space. */
  spaceOverview: string | null
  /** Wi-Fi network name (SSID). */
  wifiName: string | null
  /** Wi-Fi password — passed through sanitize() unchanged (see SAFE_OVERRIDES). */
  wifiPassword: string | null
}

/**
 * Booking configuration returned when `include=bookings` is requested —
 * pricing policies, fees, discounts, and occupancy rules for the
 * property.
 *
 * Shape is deliberately opaque (`unknown`) because it's a large and
 * loosely-structured configuration object that varies significantly by
 * platform and account type. Narrow with a type guard at the call site
 * if you need to read specific fields. Observed top-level keys include:
 * `bookingPolicies`, `discounts`, `fees`, `listingMarkups`,
 * `occupancyBasedRules`, `securityDepositCollector`, `securityDeposits`,
 * `siteUrls`.
 */
export type PropertyBookings = unknown

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

  // Include-gated fields. Populated only when the corresponding value is
  // passed to `include=` on list() or get(). Unknown includes are
  // silently ignored by the API — pass only {@link PropertyIncludeField}
  // literals to avoid typos that fail open.
  /** Populated when `include=user` is requested. */
  user?: PropertyUser
  /** Populated when `include=listings` is requested — one entry per channel. */
  listings?: PropertyListing[]
  /** Populated when `include=details` is requested. Contains `wifiPassword`. */
  details?: PropertyDetails
  /** Populated when `include=bookings` is requested. Opaque — narrow at use site. */
  bookings?: PropertyBookings
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
