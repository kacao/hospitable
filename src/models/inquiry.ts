import type { Property } from './property'
import type { Message } from './message'
import type { PaginatedResponse } from './pagination'

export interface InquiryGuestCounts {
  total: number
  adultCount: number
  childCount: number
  infantCount: number
  petCount: number
}

/**
 * Inquiry guests return only first/last name by default. Extra fields may appear
 * when `include=guest` is passed — kept optional to avoid breaking on bare responses.
 */
export interface InquiryGuest {
  firstName: string
  lastName: string
  email?: string | null
  phoneNumbers?: string[]
  profilePicture?: string | null
  language?: string
}

export interface InquiryListing {
  platform: string
  platformId: string
  platformName?: string
  platformEmail?: string
}

export interface InquiryUser {
  id: string
  email: string
  name: string
}

/**
 * An inquiry — the pre-booking conversation/request stage.
 *
 * `inquiry.id` **is the conversation ID** — pass it directly to
 * `client.messages.list(inquiry.id)` to fetch the message thread, or to
 * `client.messages.sendForInquiry(inquiry.id, body)` to reply.
 *
 * The Hospitable API returns a single `Property` in a field awkwardly named
 * `properties` (plural-but-singular). {@link normalizeInquiry} aliases it to
 * `property` for nicer DX — both reference the same object. Prefer
 * `inquiry.property` in new code.
 */
export interface Inquiry {
  id: string
  platform: string
  inquiryDate: string
  arrivalDate?: string
  departureDate?: string
  guests: InquiryGuestCounts
  guest: InquiryGuest
  /**
   * Included via `include=properties`. Singular despite the plural name — API quirk.
   * @deprecated Prefer {@link Inquiry.property}. Both point at the same object.
   */
  properties?: Property
  /** Alias for `properties`, populated by `normalizeInquiry`. Same object reference. */
  property?: Property
  /** Included via `include=listings`. */
  listings?: InquiryListing[]
  /** Included via `include=user`. */
  user?: InquiryUser
  /** Included via `include=messages` (only available on get-by-uuid). */
  messages?: Message[]
}

export type InquiryList = PaginatedResponse<Inquiry>

export type InquiryIncludeField =
  | 'financials'
  | 'guest'
  | 'properties'
  | 'listings'
  | 'messages'

export interface InquiryListParams {
  /** Required by the API — array of property UUIDs to query. */
  properties: string[]
  /** Comma-separated: any of `financials,guest,properties,listings`. */
  include?: string
  /** Inquiries where the last message is after the specified datetime (ISO 8601). */
  lastMessageAt?: string
  page?: number
  perPage?: number
}

/**
 * Normalize an Inquiry response by aliasing the `properties` field to `property`.
 *
 * Contract:
 *  - Mutates and returns the same inquiry object (resource code relies on identity).
 *  - No-op when `properties` is undefined (happens when the include was not requested).
 *  - Does NOT overwrite an existing `property` field if already set.
 */
export function normalizeInquiry(inquiry: Inquiry): Inquiry {
  if (inquiry.properties && inquiry.property === undefined) {
    inquiry.property = inquiry.properties
  }
  return inquiry
}
