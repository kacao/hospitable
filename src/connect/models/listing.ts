import type { Channel } from './channel'
import type { ConnectPlatform, Financial } from './shared'

export interface ListingAddress {
  street: string
  zipcode: string
  city: string
  state: string
  apt: string
  countryCode: string
  latitude: number
  longitude: number
}

export interface ListingCapacity {
  max: number | null
  bedrooms: number | null
  beds: number | null
  bathrooms: number | null
}

export interface ListingRoomBed {
  type: string
  quantity: number
}

/**
 * Room-by-room layout. Non-sleeping rooms (kitchen, living_room)
 * appear with an empty `beds` array.
 */
export type ListingRoomDetails = Array<{ beds: ListingRoomBed[] }>

export interface ListingDetails {
  spaceOverview: string | null
  guestAccess: string | null
  houseManual: string | null
  notes: string | null
  additionalRules: string | null
  neighborhoodDescription: string | null
  gettingAround: string | null
  wifiName: string | null
  wifiPassword: string | null
}

export interface ListingHouseRules {
  petsAllowed: boolean
  smokingAllowed: boolean
  eventsAllowed: boolean
}

/**
 * A per-listing fee configured by the host. `fee` is either a
 * {@link Financial} (when `type === 'flat'`) or an integer percentage
 * (when `type === 'percent'`). `chargeType` determines the multiplier
 * (per group / per pet / per person) and `chargePeriod` determines
 * whether the fee applies per night or once per booking.
 */
export interface ListingFee {
  name: string
  type: 'flat' | 'percent'
  fee: Financial | number
  chargeType: 'per_group' | 'per_pet' | 'per_person'
  chargePeriod: 'per_night' | 'per_booking'
}

/**
 * A listing is a rentable unit on an OTA channel. Channels may expose
 * the same listing under `channel` (primary) and `channels` (all).
 *
 * **Field naming quirk:** the API returns `check-in` and `check-out`
 * with a hyphen, not underscore. The SDK's snake-to-camel converter
 * only transforms underscores, so these keys pass through unchanged
 * — hence the quoted property names below.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface Listing {
  id: string
  platform: ConnectPlatform
  platformId: string
  publicName: string
  privateName: string
  summary: string
  description: string
  roomType: string
  propertyType: string
  picture: string
  address: ListingAddress
  capacity: ListingCapacity
  roomDetails: ListingRoomDetails
  bathrooms: number
  bedrooms: number
  available: number
  channel: Channel
  channels: Channel[]
  fees: ListingFee[]
  amenities: string[]
  'check-in': string | null
  'check-out': string | null
  details: ListingDetails
  houseRules: ListingHouseRules
}

export interface ListingImage {
  url: string
  thumbnailUrl: string
  caption: string
  order: number
}

/**
 * A single day on the listing's pricing + availability calendar.
 *
 * The Connect calendar endpoint returns an array of these per listing.
 * `date` is `YYYY-MM-DD`. `availability` reflects whether the day is
 * bookable; `price` holds the host-set price for the day.
 */
export interface CalendarDay {
  date: string
  availability: {
    available: boolean
    minStay?: number
    maxStay?: number
    closedForCheckIn?: boolean
    closedForCheckOut?: boolean
  }
  price: Financial
}

/**
 * Input for `PUT /listings/{listing}/calendar`. Batch of day-level
 * updates for pricing and/or availability.
 */
export interface UpdateCalendarDay {
  date: string
  price?: { amount: number; currency: string }
  availability?: {
    available?: boolean
    minStay?: number
    maxStay?: number
    closedForCheckIn?: boolean
    closedForCheckOut?: boolean
  }
}
