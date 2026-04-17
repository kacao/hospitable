import { describe, it, expect } from 'vitest'
import {
  isConnectWebhookAction,
  isConnectWebhookFamily,
  type ChannelWebhookPayload,
  type ConnectWebhookPayload,
  type ListingWebhookPayload,
  type PayoutWebhookPayload,
  type ReservationWebhookPayload,
  type ReviewWebhookPayload,
  type TransactionWebhookPayload,
} from '../../connect/webhooks'
import type { Channel } from '../../connect/models/channel'
import type { Customer } from '../../connect/models/customer'
import type { Financial } from '../../connect/models/shared'

const reservationPayload: ReservationWebhookPayload = {
  id: '01H3',
  created: '2026-04-16T00:00:00Z',
  action: 'reservation.created',
  version: '2023-03-02',
  // shape only — tests are about envelope + guards, not field coverage
  data: {} as ReservationWebhookPayload['data'],
}

const reviewPayload: ConnectWebhookPayload = {
  id: '01H4',
  created: '2026-04-16T00:00:00Z',
  action: 'review.published',
  version: '2023-03-02',
  data: {} as ConnectWebhookPayload['data'],
} as ConnectWebhookPayload

describe('Connect webhook type guards', () => {
  it('isConnectWebhookAction narrows to the exact action', () => {
    const p: ConnectWebhookPayload = reservationPayload
    if (isConnectWebhookAction(p, 'reservation.created')) {
      // Should type-narrow to ReservationWebhookPayload at compile time
      expect(p.action).toBe('reservation.created')
    } else {
      expect.unreachable()
    }
  })

  it('isConnectWebhookAction returns false for mismatched action', () => {
    expect(isConnectWebhookAction(reservationPayload, 'review.created')).toBe(false)
  })

  it('isConnectWebhookFamily matches by prefix', () => {
    expect(isConnectWebhookFamily(reservationPayload, 'reservation')).toBe(true)
    expect(isConnectWebhookFamily(reservationPayload, 'review')).toBe(false)
    expect(isConnectWebhookFamily(reviewPayload, 'review')).toBe(true)
  })

  it('envelope carries id/created/action/version/data', () => {
    expect(reservationPayload).toHaveProperty('id')
    expect(reservationPayload).toHaveProperty('created')
    expect(reservationPayload).toHaveProperty('action')
    expect(reservationPayload).toHaveProperty('version')
    expect(reservationPayload).toHaveProperty('data')
  })
})

/* ------------ Realistic fixtures (issue #53) ------------
 *
 * The original tests above use `{} as T['data']` — the type guard branches
 * "work" because branch coverage is incidentally hit, but the narrowed-type
 * `data` field path is never meaningfully asserted. These tests build
 * shape-accurate payloads per family and exercise field access on the
 * narrowed type without any cast. A type-guard regression that removed a
 * field from the narrowing would now fail to compile.
 */

const financial: Financial = {
  amount: 25000,
  formatted: '$250.00',
  currency: 'USD',
  label: null,
}

const channel: Channel = {
  id: 'ch_01',
  platform: 'airbnb',
  platformId: 'abb_u_12345',
  name: "Host's Airbnb",
  picture: null,
  location: 'San Francisco, CA',
  description: null,
  firstConnectedAt: '2026-01-01T00:00:00Z',
  readyToMigrate: null,
}

const customer: Customer = {
  id: 'cust_01',
  email: 'partner@example.com',
  name: 'Partner Inc',
  phone: '+15555550100',
  ipAddress: '192.0.2.1',
  timezone: 'America/Los_Angeles',
}

describe('Connect webhook payloads — narrowed field access (issue #53)', () => {
  it('channel.activated — data carries full Channel + Customer', () => {
    const payload: ChannelWebhookPayload = {
      id: '01HCHAN',
      created: '2026-04-16T00:00:00Z',
      action: 'channel.activated',
      version: '2023-03-02',
      data: { ...channel, customer },
    }
    const generic: ConnectWebhookPayload = payload
    if (isConnectWebhookFamily(generic, 'channel')) {
      // Narrowed access — no cast, no `any`.
      expect(generic.data.platform).toBe('airbnb')
      expect(generic.data.customer.email).toBe('partner@example.com')
    } else {
      expect.unreachable()
    }
  })

  it('listing.created — narrows to Listing fields + customer', () => {
    const payload: ListingWebhookPayload = {
      id: '01HLIST',
      created: '2026-04-16T00:00:00Z',
      action: 'listing.created',
      version: '2023-03-02',
      data: {
        id: 'lst_01',
        platform: 'airbnb',
        platformId: 'abb_l_99',
        publicName: 'Downtown Loft',
        privateName: 'SF-Loft-01',
        summary: 'Cozy',
        description: 'Cozy loft.',
        roomType: 'entire_home',
        propertyType: 'apartment',
        picture: 'https://example.com/p.jpg',
        address: {
          street: '1 Market St',
          zipcode: '94105',
          city: 'San Francisco',
          state: 'CA',
          apt: '',
          countryCode: 'US',
          latitude: 37.79,
          longitude: -122.4,
        },
        capacity: { max: 4, bedrooms: 1, beds: 1, bathrooms: 1 },
        roomDetails: [],
        bathrooms: 1,
        bedrooms: 1,
        available: 1,
        channel,
        channels: [channel],
        fees: [],
        amenities: ['wifi'],
        'check-in': '15:00',
        'check-out': '11:00',
        details: {
          spaceOverview: null,
          guestAccess: null,
          houseManual: null,
          notes: null,
          additionalRules: null,
          neighborhoodDescription: null,
          gettingAround: null,
          wifiName: null,
          wifiPassword: null,
        },
        houseRules: { petsAllowed: false, smokingAllowed: false, eventsAllowed: false },
        customer,
      },
    }
    const generic: ConnectWebhookPayload = payload
    if (isConnectWebhookAction(generic, 'listing.created')) {
      expect(generic.data.publicName).toBe('Downtown Loft')
      expect(generic.data.address.city).toBe('San Francisco')
      expect(generic.data.customer.id).toBe('cust_01')
    } else {
      expect.unreachable()
    }
  })

  it('reservation.created — narrows to Reservation fields + listing/channel/customer', () => {
    const payload: ReservationWebhookPayload = {
      id: '01HRES',
      created: '2026-04-16T00:00:00Z',
      action: 'reservation.created',
      version: '2023-03-02',
      data: {
        id: 'res_01',
        platform: 'airbnb',
        platformId: 'abb_r_123',
        bookingDate: '2026-04-10',
        arrivalDate: '2026-05-01',
        departureDate: '2026-05-03',
        status: 'accept',
        statusHistory: [
          { category: 'confirmed', status: 'accept', createdAt: '2026-04-10T00:00:00Z' },
        ],
        guests: { total: 2, adultCount: 2, childCount: 0, infantCount: 0, petCount: 0 },
        guest: {
          email: 'g@example.com',
          phoneNumbers: ['+15555550200'],
          firstName: 'Test',
          lastName: 'User',
          locale: 'en',
        },
        financials: {
          guest: {
            accommodation: financial,
            cleaningFee: financial,
            serviceFee: financial,
            taxes: [],
            fees: [],
            totalFees: financial,
            discounts: [],
            subtotal: financial,
            totalPrice: financial,
          },
          host: {
            accommodation: financial,
            cleaningFee: financial,
            serviceFee: financial,
            taxes: [],
            fees: [],
            totalFees: financial,
            discounts: [],
            subtotal: financial,
            payout: financial,
          },
        },
        listing: {
          id: 'lst_01',
          platform: 'airbnb',
          platformId: 'abb_l_99',
          publicName: 'Downtown Loft',
          privateName: 'SF-Loft-01',
          summary: '',
          description: '',
          roomType: 'entire_home',
          propertyType: 'apartment',
          picture: '',
          address: {
            street: '1 Market St',
            zipcode: '94105',
            city: 'San Francisco',
            state: 'CA',
            apt: '',
            countryCode: 'US',
            latitude: 0,
            longitude: 0,
          },
          capacity: { max: 4, bedrooms: 1, beds: 1, bathrooms: 1 },
          roomDetails: [],
          bathrooms: 1,
          bedrooms: 1,
          available: 1,
          channel,
          channels: [channel],
          fees: [],
          amenities: [],
          'check-in': null,
          'check-out': null,
          details: {
            spaceOverview: null,
            guestAccess: null,
            houseManual: null,
            notes: null,
            additionalRules: null,
            neighborhoodDescription: null,
            gettingAround: null,
            wifiName: null,
            wifiPassword: null,
          },
          houseRules: { petsAllowed: false, smokingAllowed: false, eventsAllowed: false },
        },
        channel,
        customer,
      },
    }
    const generic: ConnectWebhookPayload = payload
    if (isConnectWebhookAction(generic, 'reservation.created')) {
      expect(generic.data.status).toBe('accept')
      expect(generic.data.guests.total).toBe(2)
      expect(generic.data.financials.host.payout.amount).toBe(25000)
      expect(generic.data.listing.publicName).toBe('Downtown Loft')
      expect(generic.data.channel.id).toBe('ch_01')
      expect(generic.data.customer.timezone).toBe('America/Los_Angeles')
    } else {
      expect.unreachable()
    }
  })

  it('review.published — narrows to Review with rating/visibility fields', () => {
    const payload: ReviewWebhookPayload = {
      id: '01HREV',
      created: '2026-04-16T00:00:00Z',
      action: 'review.published',
      version: '2023-03-02',
      data: {
        id: 'rev_01',
        platform: 'airbnb',
        platformId: 'abb_rv_01',
        reservationPlatformId: 'abb_r_123',
        listingPlatformId: 'abb_l_99',
        guestPlatformId: 'abb_g_01',
        guestName: null,
        reviewerRole: 'guest',
        rating: 5,
        detailedRatings: [{ rating: 5, comment: 'Clean', category: 'cleanliness' }],
        visible: true,
        publicText: 'Great stay',
        privateText: null,
        responseText: null,
        expiresAt: '2026-05-01T00:00:00Z',
        firstCompletedAt: '2026-04-15T00:00:00Z',
        submittedAt: '2026-04-15T00:00:00Z',
        respondedAt: null,
        channel,
      },
    }
    const generic: ConnectWebhookPayload = payload
    if (isConnectWebhookFamily(generic, 'review')) {
      expect(generic.data.rating).toBe(5)
      expect(generic.data.visible).toBe(true)
      expect(generic.data.detailedRatings[0]!.category).toBe('cleanliness')
      expect(generic.data.channel.platform).toBe('airbnb')
    } else {
      expect.unreachable()
    }
  })

  it('payout.created — narrows to Payout with transactions ledger', () => {
    const payload: PayoutWebhookPayload = {
      id: '01HPAY',
      created: '2026-04-16T00:00:00Z',
      action: 'payout.created',
      version: '2023-03-02',
      data: {
        id: 'pay_01',
        platform: 'airbnb',
        platformId: 'abb_p_01',
        bankAccount: '****1234',
        reference: 'ref-01',
        amount: financial,
        date: '2026-04-16',
        channel,
        transactions: [
          {
            id: 'tx_01',
            type: 'Reservation',
            details: null,
            reference: null,
            currency: 'USD',
            amount: financial,
            date: '2026-04-16',
            startDate: '2026-05-01',
          },
        ],
      },
    }
    const generic: ConnectWebhookPayload = payload
    if (isConnectWebhookAction(generic, 'payout.created')) {
      expect(generic.data.amount.formatted).toBe('$250.00')
      expect(generic.data.transactions[0]!.type).toBe('Reservation')
    } else {
      expect.unreachable()
    }
  })

  it('transaction.created — narrows to Transaction with optional payout/listing/reservation', () => {
    const payload: TransactionWebhookPayload = {
      id: '01HTX',
      created: '2026-04-16T00:00:00Z',
      action: 'transaction.created',
      version: '2023-03-02',
      data: {
        id: 'tx_02',
        type: 'Adjustment',
        details: 'goodwill credit',
        reference: null,
        currency: 'USD',
        amount: financial,
        date: '2026-04-16',
        startDate: '2026-05-01',
      },
    }
    const generic: ConnectWebhookPayload = payload
    if (isConnectWebhookFamily(generic, 'transaction')) {
      expect(generic.data.type).toBe('Adjustment')
      expect(generic.data.details).toBe('goodwill credit')
      expect(generic.data.payout).toBeUndefined()
    } else {
      expect.unreachable()
    }
  })
})
