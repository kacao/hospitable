export interface ReviewRatings {
  overall: number
  cleanliness: number | null
  communication: number | null
  checkIn: number | null
  accuracy: number | null
  location: number | null
  value: number | null
}

export interface Review {
  id: string
  reservationId: string
  propertyId: string
  guestName: string
  ratings: ReviewRatings
  body: string
  response: string | null
  submittedAt: string
  respondedAt: string | null
}

export type ReviewList = import('./pagination').PaginatedResponse<Review>

export interface ReviewListParams {
  propertyId?: string
  responded?: boolean
  cursor?: string
  perPage?: number
}
