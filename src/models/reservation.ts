/**
 * Status of a reservation as returned by the Hospitable API.
 *
 * Values are lowercase snake_case strings. Use {@link isReservationStatus}
 * to narrow an unknown string to this type.
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
 */
export type ReservationIncludeField =
  | 'guest'
  | 'properties'
  | 'financials'
  | 'listings'
  | 'user'

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

export interface Reservation {
  id: string
  propertyId?: string
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
  status: ReservationStatus
  guests: ReservationGuests
  guest?: Guest
  notes: string | null
  conversationId: string
  conversationLanguage: string | null
  lastMessageAt: string | null
  issueAlert: unknown
}

export type ReservationList = import('./pagination').PaginatedResponse<Reservation>

export interface ReservationListParams {
  /** Property UUIDs to scope the search to. */
  properties?: string[]
  /** ISO `YYYY-MM-DD` — reservations whose check-in is on or after this date. */
  startDate?: string
  /** ISO `YYYY-MM-DD` — reservations whose check-in is on or before this date. */
  endDate?: string
  /**
   * Filter by reservation status. Single value or array. Serialized as
   * repeated `status[]=` query params.
   */
  status?: ReservationStatus | ReservationStatus[]
  /** Comma-separated include fields. Prefer {@link ReservationIncludeField}. */
  include?: string
  page?: number
  perPage?: number
}
