export type ReservationStatus =
  | 'accepted'
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'declined'
  | string

export type ReservationPlatform = 'airbnb' | 'vrbo' | 'booking_com' | 'direct' | string

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

export interface OrphanDate {
  count: number
  propertyId: string
  reservationBefore: Reservation
  reservationAfter: Reservation
}

export interface ReservationListParams {
  properties?: string[]
  startDate?: string
  endDate?: string
  status?: string | string[]
  include?: string
  page?: number
  perPage?: number
}
