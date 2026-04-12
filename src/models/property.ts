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
 * A configurable fee on the property — appears in {@link PropertyBookings.fees}.
 * Distinct from per-reservation fees which live on
 * `Reservation.financials.guest.fees`.
 */
export interface PropertyBookingFee {
  /** Human-readable fee name, e.g. `"Cleaning Fee"`, `"Resort Fee"`. */
  name: string
  /** Fee type, e.g. `"flat"`, `"percentage"`, `"per_night"`. Open string union. */
  type: string
  /** Configured value for the fee — either flat amount or percentage. */
  value: {
    /** Amount in minor currency units for flat fees, or raw percentage × 100 for percentage fees. */
    amount: number
    /** Pre-formatted display string, e.g. `"$201.00"` or `"5%"`. */
    formatted: string
  }
}

/**
 * Per-platform price markup — how much the property charges above base
 * rate on a specific channel. Appears in
 * {@link PropertyBookings.listingMarkups}.
 */
export interface PropertyListingMarkup {
  /** Booking platform, e.g. `"airbnb"`, `"vrbo"`, `"direct"`. */
  platform: string
  /** Markup type, e.g. `"percentage"`, `"flat"`. Open string union. */
  type: string
  /** Markup value — interpretation depends on `type`. */
  markup: number
}

/**
 * Extra-guest / pet fee configuration returned inside
 * {@link PropertyBookings.occupancyBasedRules}.
 */
export interface PropertyOccupancyFee {
  /** Fee type — typically `"per_night"` or `"flat"`. Open string union. */
  type: string
  value: {
    amount: number
    formatted: string
  }
}

/**
 * Occupancy-based pricing rules — what's included in the base rate and
 * what costs extra beyond a threshold.
 */
export interface PropertyOccupancyBasedRules {
  /** Number of guests included in the base rate. */
  guestsIncluded: number
  /** Fee charged per additional guest over `guestsIncluded`. */
  extraGuestFee: PropertyOccupancyFee
  /** Fee charged per pet (independent of guest count). */
  petFee: PropertyOccupancyFee
}

/**
 * Payment-term configuration returned inside
 * {@link PropertyBookingPolicies.paymentTerms}.
 */
export interface PropertyPaymentTerms {
  /** Payment status, e.g. `"full_payment"`, `"deposit_required"`. */
  status: string
  /** Human-readable description lines explaining the terms. */
  description: string[]
  /** Grace period in hours before payment is considered late. */
  gracePeriod: number
}

/**
 * Cancellation + payment policies attached to the property.
 */
export interface PropertyBookingPolicies {
  /** Cancellation policy description lines — one per rule/tier. */
  cancellation: string[]
  paymentTerms: PropertyPaymentTerms
}

/**
 * Booking configuration returned when `include=bookings` is requested —
 * pricing policies, fees, discounts, and occupancy rules for the
 * property. Structured based on empirical probing of the live API; all
 * fields are always present on the response (arrays may be empty).
 *
 * Fields like `discounts`, `securityDeposits`, and
 * `securityDepositCollector` are typed as `unknown`/`unknown[]` because
 * populated examples haven't been observed yet — narrow with a type
 * guard at the call site if you encounter one.
 */
export interface PropertyBookings {
  /** Configurable property-level fees. */
  fees: PropertyBookingFee[]
  /** Occupancy-based extra charges (extra guest, pet). */
  occupancyBasedRules: PropertyOccupancyBasedRules
  /** Available discounts. Shape not yet observed populated. */
  discounts: unknown[]
  /** Per-platform price markups. */
  listingMarkups: PropertyListingMarkup[]
  /** Security deposit definitions. Shape not yet observed populated. */
  securityDeposits: unknown[]
  /** Which party collects the security deposit. */
  securityDepositCollector: unknown | null
  bookingPolicies: PropertyBookingPolicies
  /** URLs where this property is listed across platforms. */
  siteUrls: string[]
}

/**
 * An iCal feed imported from an external source — used to sync
 * third-party calendar blocks (Airbnb, Crewdogs, Google Calendar, etc.)
 * into Hospitable's unified calendar.
 *
 * ⚠️ **`url` is a shared secret.** iCal URLs from most platforms embed
 * an opaque auth token in the path (`https://example.com/ical/<token>.ics`).
 * Anyone holding the URL can read the full booking calendar. Don't log
 * `icalImports[].url` to stdout in shared contexts and don't commit it
 * to version control. The SDK's `sanitize()` does NOT redact this field
 * because `url` is too common a field name to blanket-mask.
 */
export interface PropertyIcalImport {
  id: string
  /** The iCal feed URL — ⚠️ effectively a credential, see interface JSDoc. */
  url: string
  /** Display name for this import source. */
  name: string
  /** Host of the external calendar, if known. */
  host: {
    firstName: string
    lastName: string
  }
  /** ISO 8601 timestamp of the most recent successful sync. */
  lastSyncAt: string
  /** ISO 8601 timestamp when the feed was disconnected, or `null` if active. */
  disconnectedAt: string | null
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
  /**
   * External iCal feeds synced into this property's calendar.
   *
   * **Gated on `include=listings`** — this field is part of the
   * listings bundle conceptually, so it's populated only when
   * `include=listings` (or a multi-include that contains `listings`)
   * is requested. Empirically verified against the live API; the
   * Hospitable docs don't mention this gating.
   *
   * See {@link PropertyIcalImport} for the security caveat on `.url`.
   */
  icalImports?: PropertyIcalImport[]
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
