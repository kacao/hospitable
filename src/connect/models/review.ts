import type { Channel } from './channel'
import type { ConnectPlatform } from './shared'

export type ReviewerRole = 'guest' | 'host'

/**
 * Detailed category-level ratings on a review — e.g. cleanliness,
 * communication, respect_house_rules. `category` is open-ended since
 * the platform adds new categories over time.
 */
export interface ReviewDetailedRating {
  rating: number
  comment: string | null
  category: string
}

/**
 * A review of a reservation or listing. `rating` is 1–5 (inclusive) or
 * `null` while the review is in progress. Public text is only visible
 * once both parties have completed their reviews or the review window
 * has expired (`expiresAt`).
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface Review {
  id: string
  platform: ConnectPlatform
  platformId: string
  reservationPlatformId: string | null
  listingPlatformId: string | null
  guestPlatformId: string | null
  guestName: string | null
  reviewerRole: ReviewerRole
  rating: number | null
  detailedRatings: ReviewDetailedRating[]
  visible: boolean
  publicText: string | null
  privateText: string | null
  responseText: string | null
  expiresAt: string | null
  firstCompletedAt: string | null
  submittedAt: string | null
  respondedAt: string | null
  channel: Channel
}
