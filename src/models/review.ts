/**
 * Detailed rating category returned inside `private.detailed_ratings`.
 *
 * Airbnb returns all 9 values even when the platform doesn't collect them
 * (zeroed out) — see `facilities`, `staff`, `services`, which are VRBO /
 * Booking.com only. Kept as an open string union so the SDK doesn't reject
 * future categories the API may add.
 */
export type ReviewDetailedRatingType =
  | 'value'
  | 'cleanliness'
  | 'communication'
  | 'location'
  | 'checkin'
  | 'accuracy'
  | 'facilities'
  | 'staff'
  | 'services'
  | (string & {})

export interface ReviewDetailedRating {
  type: ReviewDetailedRatingType
  /** Integer 0-5. `0` means the category was not rated on this platform. */
  rating: number
  comment: string | null
}

/**
 * Public-facing portion of a review — what the guest chose to publish on
 * the booking platform. Visible to future guests considering the listing.
 */
export interface ReviewPublic {
  /** Normalized integer 1-5. */
  rating: number
  /** Platform's original rating string (e.g. `"5.00"`, `"4.5/5"`). Provider-specific format. */
  ratingPlatformOriginal: string
  /** Guest's public review text. May be empty string. */
  review: string
  /** Host's public response, if any. */
  response: string | null
}

/**
 * Private host feedback attached to a review — not shown to other guests.
 * Hospitable exposes it here alongside the public side.
 */
export interface ReviewPrivate {
  /** Host-only feedback text. `null` when the guest left no private note. */
  feedback: string | null
  detailedRatings: ReviewDetailedRating[]
}

/**
 * Minimal guest info returned when `include=guest` is passed to the
 * reviews list endpoint. Deliberately sparse — only first/last name and
 * language are exposed (no email/phone). If you need richer guest data,
 * fetch the reservation via `client.reservations.get(reservationId,
 * 'guest')`.
 */
export interface ReviewGuest {
  firstName: string
  lastName: string
  language: string
}

/**
 * Minimal reservation info returned when `include=reservation` is passed.
 * Contains just enough to cross-reference without a second API call.
 * For the full reservation, call `client.reservations.get(review.reservation.id)`.
 */
export interface ReviewReservation {
  id: string
  /** Platform-facing reservation code (e.g. `HMQBZEMSPZ`). */
  code: string
  /** ISO 8601 with timezone offset. */
  checkIn: string
  /** ISO 8601 with timezone offset. */
  checkOut: string
}

/**
 * Minimal property info returned when `include=property` is passed.
 * Contains just enough to label the review without a second API call —
 * useful for building "recent reviews across all properties" feeds.
 * For the full property, call `client.properties.get(review.property.id)`.
 */
export interface ReviewProperty {
  id: string
  /** Internal property name (host-facing). */
  name: string
  /** Public-facing listing name shown to guests on booking platforms. */
  publicName: string
}

/**
 * A guest review from a booking platform.
 *
 * @see https://developer.hospitable.com/docs/public-api-docs/v8ue8kuzpfgvj-reviews-resource
 */
export interface Review {
  id: string
  platform: string
  public: ReviewPublic
  private: ReviewPrivate
  /** ISO 8601 — when the guest submitted the review on the platform. */
  reviewedAt: string
  /** ISO 8601 — when the host responded, or `null` if not yet responded. */
  respondedAt: string | null
  /**
   * Whether the host can still post a response. `false` after the
   * platform's response window closes, or after the review is finalized.
   */
  canRespond: boolean

  /** Populated only when `include=guest` is requested. */
  guest?: ReviewGuest
  /** Populated only when `include=reservation` is requested. */
  reservation?: ReviewReservation
  /** Populated only when `include=property` is requested. */
  property?: ReviewProperty
}

export type ReviewList = import('./pagination').PaginatedResponse<Review>

/**
 * Include fields accepted by the reviews list endpoint.
 *
 * Empirically verified against the live API on 2026-04-11. Note that
 * `reservation` is **singular** — passing `'reservations'` (plural)
 * returns HTTP 200 with no side-loaded field (silent ignore). Same for
 * `property` vs `'properties'` — use the singular form.
 */
export type ReviewIncludeField = 'guest' | 'reservation' | 'property'

export interface ReviewListParams {
  /** Filter by whether the host has responded. Omit to include both. */
  responded?: boolean
  /**
   * Comma-separated include fields. Prefer {@link ReviewIncludeField}.
   * Unknown values are silently ignored by the API.
   *
   * Example: `'guest,reservation'` — populates both `review.guest` and
   * `review.reservation` on each returned object.
   */
  include?: string
  page?: number
  perPage?: number
}

/**
 * Body for posting a host response to a review.
 *
 * @see POST https://public.api.hospitable.com/v2/reviews/{id}/respond
 */
export interface ReviewRespondBody {
  response: string
}
