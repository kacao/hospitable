export type ReservationStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'inquiry'
  | 'declined'
  | 'expired'

export type ReservationPlatform = 'airbnb' | 'vrbo' | 'booking_com' | 'direct' | string

export interface Guest {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUrl: string | null
  verified: boolean
}

export interface ReservationMoney {
  amount: number
  currency: string
}

export interface Reservation {
  id: string
  propertyId: string
  platform: ReservationPlatform
  platformId: string
  status: ReservationStatus
  checkinDate: string
  checkoutDate: string
  nights: number
  guestCount: number
  guest?: Guest
  totalAmount: ReservationMoney
  cleaningFee: ReservationMoney
  platformFee: ReservationMoney
  createdAt: string
  updatedAt: string
}

export type ReservationList = import('./pagination').PaginatedResponse<Reservation>

export interface ReservationListParams {
  properties?: string[]
  startDate?: string
  endDate?: string
  status?: ReservationStatus | ReservationStatus[]
  include?: string
  cursor?: string
  perPage?: number
}
