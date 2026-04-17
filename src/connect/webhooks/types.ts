import type { Channel } from '../models/channel'
import type { Listing } from '../models/listing'
import type { Payout } from '../models/payout'
import type { Reservation } from '../models/reservation'
import type { Review } from '../models/review'
import type { Transaction } from '../models/transaction'
import type { Customer } from '../models/customer'

/**
 * Every Connect webhook payload shares this envelope. `id` is a ULID,
 * `created` is ISO-8601, `action` identifies the event, `version` is
 * the schema version the platform used to serialize the event, and
 * `data` carries the domain object + embedded related resources.
 *
 * Return 200 to acknowledge receipt — the platform retries on any
 * non-2xx response.
 *
 * ⚠️  **Security.** The type guards ({@link isConnectWebhookAction},
 * {@link isConnectWebhookFamily}) only narrow the shape — they do NOT
 * authenticate the sender. Anyone who discovers your webhook URL can POST
 * a forged body that passes both guards. Before trusting any incoming
 * payload, verify its HMAC signature with {@link verifyWebhookSignature}
 * using the shared secret from your Hospitable integration.
 */
export interface ConnectWebhookEnvelope<Action extends string, Data> {
  id: string
  created: string
  action: Action
  version: string
  data: Data
}

/* ---------- Channel events ---------- */

export type ChannelWebhookAction = 'channel.activated'

export interface ChannelWebhookData extends Channel {
  /**
   * Customer who owns this channel connection. Always embedded on
   * channel events so partners can route the payload to the right
   * tenant without a follow-up GET.
   */
  customer: Customer
}

export type ChannelWebhookPayload = ConnectWebhookEnvelope<
  ChannelWebhookAction,
  ChannelWebhookData
>

/* ---------- Listing events ---------- */

export type ListingWebhookAction =
  | 'listing.created'
  | 'listing.changed'
  | 'listing.deactivated'
  | 'listing.reactivated'

export interface ListingWebhookData extends Listing {
  customer: Customer
}

export type ListingWebhookPayload = ConnectWebhookEnvelope<
  ListingWebhookAction,
  ListingWebhookData
>

/* ---------- Reservation events ---------- */

export type ReservationWebhookAction = 'reservation.created' | 'reservation.changed'

export interface ReservationWebhookData extends Reservation {
  /** Listing this reservation is against. */
  listing: Listing
  /** Channel the booking came through. */
  channel: Channel
  /** Customer who owns the channel. */
  customer: Customer
}

export type ReservationWebhookPayload = ConnectWebhookEnvelope<
  ReservationWebhookAction,
  ReservationWebhookData
>

/* ---------- Review events ---------- */

export type ReviewWebhookAction =
  | 'review.created'
  | 'review.submitted'
  | 'review.published'
  | 'review.changed'
  | 'review.expired'
  | 'review.response_submitted'

export type ReviewWebhookPayload = ConnectWebhookEnvelope<ReviewWebhookAction, Review>

/* ---------- Payout events ---------- */

export type PayoutWebhookAction = 'payout.created' | 'payout.changed'

export type PayoutWebhookPayload = ConnectWebhookEnvelope<PayoutWebhookAction, Payout>

/* ---------- Transaction events ---------- */

export type TransactionWebhookAction = 'transaction.created' | 'transaction.changed'

export interface TransactionWebhookData extends Transaction {
  payout?: Payout
  channel?: Channel
  listing?: Listing
  reservation?: Reservation
}

export type TransactionWebhookPayload = ConnectWebhookEnvelope<
  TransactionWebhookAction,
  TransactionWebhookData
>

/* ---------- Discriminated union over every event ---------- */

export type ConnectWebhookPayload =
  | ChannelWebhookPayload
  | ListingWebhookPayload
  | ReservationWebhookPayload
  | ReviewWebhookPayload
  | PayoutWebhookPayload
  | TransactionWebhookPayload

export type ConnectWebhookAction = ConnectWebhookPayload['action']

/**
 * Type guard factory — narrows a generic payload to the requested event
 * family. Use at webhook-endpoint entry points to route by event type
 * without manual `as` casts.
 *
 * @example
 * ```ts
 * if (isConnectWebhookAction(payload, 'reservation.created')) {
 *   // payload.data is typed as ReservationWebhookData here
 * }
 * ```
 */
export function isConnectWebhookAction<A extends ConnectWebhookAction>(
  payload: ConnectWebhookPayload,
  action: A,
): payload is Extract<ConnectWebhookPayload, { action: A }> {
  return payload.action === action
}

/**
 * Broader family guard — narrows to all events sharing a prefix.
 *
 * @example
 * ```ts
 * if (isConnectWebhookFamily(payload, 'reservation')) {
 *   // payload is ReservationWebhookPayload
 * }
 * ```
 */
export function isConnectWebhookFamily<
  F extends 'channel' | 'listing' | 'reservation' | 'review' | 'payout' | 'transaction',
>(
  payload: ConnectWebhookPayload,
  family: F,
): payload is Extract<ConnectWebhookPayload, { action: `${F}.${string}` }> {
  return payload.action.startsWith(`${family}.`)
}
