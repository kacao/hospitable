/**
 * Status of a reservation as returned by the Hospitable API.
 *
 * Values are lowercase snake_case strings. Use {@link isReservationStatus}
 * to narrow an unknown string to this type.
 *
 * ⚠️ Spelling trap: the legacy {@link Reservation.status} and
 * {@link ReservationStatusHistoryEntry} fields use British `cancelled`, while
 * the older {@link ReservationLegacyStatusHistoryEntry} (exposed on the
 * `status_history` field) uses American `canceled`. New code should read
 * {@link Reservation.reservationStatus} and avoid both legacy shapes.
 */
export type ReservationStatus =
  | 'not_accepted'
  | 'request'
  | 'accepted'
  | 'cancelled'
  | 'checkpoint'

export const RESERVATION_STATUSES = [
  'not_accepted',
  'request',
  'accepted',
  'cancelled',
  'checkpoint',
] as const satisfies readonly ReservationStatus[]

/** Type guard for {@link ReservationStatus}. */
export function isReservationStatus(value: unknown): value is ReservationStatus {
  return typeof value === 'string' && (RESERVATION_STATUSES as readonly string[]).includes(value)
}

/**
 * Booking platform the reservation originated on. Kept as an open string
 * union — the upstream API may surface additional platforms (`homeaway`,
 * `custom-direct`, etc.) that agents should pass through rather than reject.
 */
export type ReservationPlatform = 'airbnb' | 'vrbo' | 'booking_com' | 'direct' | (string & {})

/**
 * Include fields accepted by `GET /v2/reservations` and `GET /v2/reservations/{id}`.
 *
 * Empirically verified against the live API on 2026-04-11. Unknown includes
 * are silently ignored by the server — passing an invalid value won't error,
 * it just won't populate any extra fields.
 */
export type ReservationIncludeField =
  | 'guest'
  | 'user'
  | 'financials'
  | 'listings'
  | 'properties'
  | 'review'
  | 'smartlock_code'

/**
 * Selector for which date field `startDate`/`endDate` filter against.
 *
 * - `checkin` (default) — filter by `check_in` date. Use this to find
 *   reservations arriving in a window.
 * - `checkout` — filter by `check_out` date. Use this to find reservations
 *   departing in a window, or guests currently in-house.
 *
 * The API only accepts these two literal values. Other values (including
 * `checkin_or_checkout`) return 400.
 */
export type ReservationDateQuery = 'checkin' | 'checkout'

export interface Guest {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phoneNumbers: string[]
  profilePicture: string | null
  location: string | null
  language: string
}

export interface ReservationGuests {
  total: number
  adultCount: number
  childCount: number
  infantCount: number
  petCount: number
}

/**
 * A single line-item on a reservation's financial breakdown. Used by
 * every entry inside the `guest` and `host` subsections of
 * {@link ReservationFinancials} — accommodation, fees, discounts, taxes,
 * adjustments, payments, and totals all share this exact shape.
 *
 * ⚠️ **`amount` can be negative** — discounts and host-side service
 * fees arrive as negative integers (e.g. `-121365` for a
 * `-$1,213.65` early-bird discount). Don't assume positivity.
 */
export interface ReservationFinancialLineItem {
  /** Minor currency units (cents for USD). May be negative. */
  amount: number
  /** Pre-formatted display string, e.g. `"$1,483.35"` or `"-$1,213.65"`. */
  formatted: string
  /** Human-readable label, e.g. `"Cleaning Fee"`, `"Early Bird Discount"`. */
  label: string
  /**
   * Grouping category. Values seen: `"Accommodation"`, `"Guest fees"`,
   * `"Guest total price"`, `"Host Tax"`, `"Service fees"`, `"Discounts"`,
   * `"Revenue"`. Open string union for forward compatibility.
   */
  category: string
}

/**
 * Guest-facing financial breakdown — what the guest is shown and charged
 * on the booking platform. Every sub-array is `[]` when no entries
 * apply; arrays are never `null`.
 */
export interface ReservationFinancialsGuest {
  /** Base room rate before fees/taxes/discounts. */
  accommodation: ReservationFinancialLineItem
  /** Accommodation amount divided by night count, for display. */
  averageNightlyRate: ReservationFinancialLineItem
  /** Guest-side fees (cleaning, pet, extra-guest, etc.). */
  fees: ReservationFinancialLineItem[]
  /** Guest-side discounts. Amounts are negative. */
  discounts: ReservationFinancialLineItem[]
  /** Taxes charged to the guest (occupancy, lodging, VAT, etc.). */
  taxes: ReservationFinancialLineItem[]
  /** Manual adjustments applied to the guest total. */
  adjustments: ReservationFinancialLineItem[]
  /** Payment records (typically populated post-stay). */
  payments: ReservationFinancialLineItem[]
  /** Final total charged to the guest. */
  totalPrice: ReservationFinancialLineItem
}

/**
 * Host-side financial breakdown — what the host earns after platform
 * fees. This is the "revenue" side of the ledger.
 */
export interface ReservationFinancialsHost {
  /** Base accommodation revenue. */
  accommodation: ReservationFinancialLineItem
  /**
   * Per-day rate breakdown. `null` when the stay is a single flat rate;
   * otherwise an array with one entry per night, labeled with the date.
   */
  accommodationBreakdown: ReservationFinancialLineItem[] | null
  /** Fees collected from the guest and passed through to the host. */
  guestFees: ReservationFinancialLineItem[]
  /** Host-side service fees charged by the platform. Amounts typically negative. */
  hostFees: ReservationFinancialLineItem[]
  /** Host-side discounts (promotional, loyalty, etc.). Amounts negative. */
  discounts: ReservationFinancialLineItem[]
  /** Manual adjustments applied to host revenue. */
  adjustments: ReservationFinancialLineItem[]
  /** Taxes withheld from host revenue (rare — usually guest-side). */
  taxes: ReservationFinancialLineItem[]
  /** Final amount the host receives after all adjustments. */
  revenue: ReservationFinancialLineItem
}

/**
 * Full financial breakdown for a reservation. Returned when the
 * `include=financials` query parameter is passed to the reservations
 * list or get endpoint. Requires the `financials:read` OAuth2 scope on
 * the access token.
 *
 * Split into `guest` (what the guest pays) and `host` (what the host
 * receives). The two sides are reconciled via platform fees, taxes, and
 * service charges — see {@link ReservationFinancialsHost.hostFees} for
 * the platform's cut.
 *
 * @see GET https://public.api.hospitable.com/v2/reservations (include=financials)
 */
export interface ReservationFinancials {
  /** ISO 4217 currency code (e.g. `"USD"`). */
  currency: string
  guest: ReservationFinancialsGuest
  host: ReservationFinancialsHost
}

/**
 * Structured status object returned by the current API on the
 * `reservation_status` field. Carries both the current state and a full
 * history of transitions with sub-category detail the flat {@link
 * Reservation.status} string cannot express (e.g. `accepted` +
 * `early_checkin_requested`).
 *
 * Prefer this over {@link Reservation.status} / {@link Reservation.statusHistory}
 * in new code.
 */
export interface ReservationStatusObject {
  current: {
    category: ReservationStatus
    subCategory: string | null
  }
  history: ReservationStatusHistoryEntry[]
}

export interface ReservationStatusHistoryEntry {
  category: ReservationStatus
  subCategory: string | null
  changedAt: string
}

/**
 * Legacy status history entry exposed on the `status_history` field.
 *
 * ⚠️ The `status` field here uses **American** spelling (`canceled`) while
 * everything else in the API uses British spelling (`cancelled`). Strict
 * equality against `'cancelled'` will silently miss matches. Migrate to
 * {@link ReservationStatusObject.history} which uses consistent British spelling.
 *
 * @deprecated Use {@link Reservation.reservationStatus}.
 */
export interface ReservationLegacyStatusHistoryEntry {
  /** Human-readable label, e.g. "Accepted", "Cancelled". */
  category: string
  /** Raw status value — **uses American spelling** (`canceled` vs `cancelled`). */
  status: string
  changedAt: string
}

export interface Reservation {
  id: string
  code: string
  platform: ReservationPlatform
  platformId: string
  bookingDate: string
  arrivalDate: string
  departureDate: string
  checkIn: string
  checkOut: string
  nights: number
  stayType: string
  ownerStay: boolean | null

  /**
   * Structured status with history. Preferred over {@link status} and
   * {@link statusHistory} — carries sub-category detail the flat string
   * cannot express, and uses consistent British spelling throughout.
   */
  reservationStatus: ReservationStatusObject

  /**
   * Legacy flat status string. Uses British spelling (`cancelled`).
   * @deprecated Read {@link reservationStatus}.current.category instead.
   */
  status: ReservationStatus

  /**
   * Legacy status history array.
   *
   * ⚠️ **Spelling trap**: each entry's `.status` field uses **American**
   * spelling (`canceled`) while the modern {@link ReservationStatus} union
   * uses British spelling (`cancelled`). Strict-equality checks against
   * `'cancelled'` would silently miss matches on raw API data.
   *
   * The SDK's `ReservationsResource` normalizes this on every response
   * (via `normalizeReservation()`), so you'll actually see `'cancelled'`
   * here when reading through the client. But if you receive a Reservation
   * from any other source — webhook payload, cached pre-normalization,
   * hand-constructed test fixture — the raw value may still be `'canceled'`.
   *
   * @deprecated Read {@link reservationStatus}.history instead — it uses
   *   consistent British spelling upstream and includes `subCategory`
   *   detail this legacy field can't express.
   */
  statusHistory: ReservationLegacyStatusHistoryEntry[]

  guests: ReservationGuests
  /** Only populated when `include=guest` is requested. */
  guest?: Guest
  /** Only populated when `include=user` is requested. */
  user?: ReservationUser
  /**
   * Full financial breakdown. Populated only when `include=financials`
   * is requested and the access token has the `financials:read` scope.
   */
  financials?: ReservationFinancials
  /** Only populated when `include=properties` is requested. */
  properties?: unknown[]
  /** Only populated when `include=listings` is requested. */
  listings?: unknown[]
  /**
   * Only populated when `include=review` is requested. `null` when the
   * reservation has no review yet (e.g. still in progress, or cancelled).
   */
  review?: unknown | null
  /**
   * Smart-lock access code for the property during this reservation,
   * typically a 4-digit numeric string. Populated only when
   * `include=smartlock_code` is requested. `null` when the property has
   * no smart lock configured, or the reservation doesn't have a code
   * assigned yet (e.g. cancelled, far-future, not-accepted).
   *
   * This field is **not** redacted by `sanitize()` — like `wifiPassword`
   * on a property, it's a shareable credential an agent needs to include
   * in guest check-in messages. Don't log raw Reservation objects to
   * stdout in contexts where bystanders might see them.
   *
   * Wire format: the API serializes this as `smartlock_code`
   * (snake_case); the SDK's `deepSnakeToCamel` converts it to
   * `smartlockCode` on the TypeScript side.
   */
  smartlockCode?: string | null

  notes: string | null
  conversationId: string
  conversationLanguage: string | null
  lastMessageAt: string | null
  issueAlert: unknown
}

/** User/host attached to a reservation via `include=user`. */
export interface ReservationUser {
  id: string
  email: string
  name: string
  profilePicture: string | null
}

export type ReservationList = import('./pagination').PaginatedResponse<Reservation>

/**
 * Normalize a Reservation returned by the API so legacy fields are safe
 * to compare against modern `ReservationStatus` values.
 *
 * Specifically: the legacy `status_history[].status` field uses American
 * spelling (`canceled`), while every other status field in the API uses
 * British spelling (`cancelled`). An agent doing
 * `r.statusHistory.some(h => h.status === 'cancelled')` would silently
 * miss cancelled reservations — a business-logic bug with real financial
 * impact (charges sent to guests who canceled, "in-house" classification
 * of guests who canceled, etc.).
 *
 * This normalizer rewrites `canceled` → `cancelled` in place on each
 * `statusHistory` entry's `status` field. It's called by
 * `ReservationsResource.list()`, `.get()`, and `.iter()` so consumers
 * always see consistent British spelling.
 *
 * Idempotent and safe on partial / incomplete data: missing fields are
 * left alone.
 *
 * Contract:
 *  - Mutates and returns the same reservation object.
 *  - Only touches `statusHistory[].status` when the value is exactly
 *    `'canceled'` — any other value is preserved.
 */
export function normalizeReservation(reservation: Reservation): Reservation {
  if (Array.isArray(reservation.statusHistory)) {
    for (const entry of reservation.statusHistory) {
      if (entry.status === 'canceled') {
        entry.status = 'cancelled'
      }
    }
  }
  return reservation
}

/**
 * Who initiated the cancellation — used as the body of
 * `POST /v2/reservations/{uuid}/cancel`.
 */
export type CancelReservationInitiatedBy = 'host' | 'guest'

/**
 * WRITE-side input shape for reservation financials. NOT the same as
 * {@link ReservationFinancials} (READ-side with nested guest/host
 * subsections). All amounts in minor currency units (cents).
 *
 * @see POST https://public.api.hospitable.com/v2/reservations
 */
export interface CreateReservationFinancials {
  /** ISO 4217 currency code (e.g. `"USD"`). */
  currency: string
  /** Base accommodation amount in minor currency units. */
  accommodation: number
  cleaningFee?: number
  linenFee?: number
  managementFee?: number
  communityFee?: number
  petFee?: number
  resortFee?: number
  passThroughTaxes?: number
  otherFees?: Array<{ label: string; amount: number }>
}

/** Guest contact info for creating a reservation. */
export interface CreateReservationGuest {
  firstName: string
  lastName: string
  email: string
  phone?: string
}

/** Guest headcounts for creating/updating a reservation. */
export interface CreateReservationGuestCounts {
  adults: number
  children?: number
  infants?: number
  pets?: number
}

/**
 * Parameters for `POST /v2/reservations` — creating a direct reservation.
 *
 * @see POST https://public.api.hospitable.com/v2/reservations
 */
export interface CreateReservationParams {
  propertyId: string
  /** ISO `YYYY-MM-DD` check-in date. */
  checkIn: string
  /** ISO `YYYY-MM-DD` check-out date. */
  checkOut: string
  guests: CreateReservationGuestCounts
  guest: CreateReservationGuest
  /** Two-letter language code (e.g. `"en"`). */
  language: string
  financials: CreateReservationFinancials
  channel?: string
  notes?: string
  reservationCode?: string
  include?: string
}

/**
 * Parameters for `PUT /v2/reservations/{uuid}` — updating an existing
 * reservation. Currency is not required on update (inherited from the
 * existing reservation).
 *
 * @see PUT https://public.api.hospitable.com/v2/reservations/{uuid}
 */
export interface UpdateReservationParams {
  checkIn: string
  checkOut: string
  guests: CreateReservationGuestCounts
  guest: CreateReservationGuest
  language: string
  financials: Omit<CreateReservationFinancials, 'currency'>
  notes?: string
  include?: string
}

export interface ReservationListParams {
  /**
   * Property UUIDs to scope the search to. **Required by the API** — omit
   * this and the server returns `400 "The properties field is required."`.
   * The SDK throws a {@link ConfigurationError} before the request is sent
   * so agents get actionable feedback without a round trip.
   */
  properties: string[]
  /** ISO `YYYY-MM-DD` — lower bound on the date field chosen by `dateQuery`. */
  startDate?: string
  /** ISO `YYYY-MM-DD` — upper bound on the date field chosen by `dateQuery`. */
  endDate?: string
  /**
   * Which date field `startDate`/`endDate` filter against.
   * Defaults to `checkin` on the API side if omitted.
   */
  dateQuery?: ReservationDateQuery
  /**
   * Only reservations whose last-message timestamp is on or after this value.
   *
   * ⚠️ Format quirk: the API expects **`YYYY-MM-DD HH:MM:SS`** (space-separated,
   * no timezone), NOT ISO 8601. Example: `'2026-01-15 14:30:00'`.
   */
  lastMessageAt?: string
  /**
   * Filter by reservation status. Single value or array. Serialized as
   * repeated `status[]=` query params.
   */
  status?: ReservationStatus | ReservationStatus[]
  /**
   * Comma-separated include fields. Prefer {@link ReservationIncludeField}.
   * Unknown values are silently ignored by the API.
   */
  include?: string
  page?: number
  perPage?: number
}
