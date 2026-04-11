/**
 * A message attachment — typically a photo attached to a guest or host
 * message on platforms like Airbnb that support rich conversations.
 *
 * Shape verified against live API (2026-04-11). Only `type: 'image'` has
 * been observed in the wild, but the union is left open so future media
 * types (e.g. video, document) don't break consumers.
 *
 * Note: attachment URLs returned by Airbnb are **pre-signed and
 * short-lived** (AWS S3 signatures with ~1h expiry). Don't persist the
 * URL — re-fetch the message when you need the content.
 */
export interface MessageAttachment {
  type: 'image' | (string & {})
  url: string
}

/**
 * A message reaction — reserved for future use. Hospitable's API returns
 * this field on every message but it has never been observed populated in
 * our probes. Left as `unknown` so the SDK doesn't force a shape on data
 * we haven't seen yet; narrow with a type guard if you encounter one.
 */
export type MessageReaction = unknown

export interface MessageSender {
  firstName: string
  /** Display name — often just the first name, sometimes full. */
  fullName: string
  /** Locale code (e.g. `"en"`). Empty string when unset on host accounts. */
  locale: string
  pictureUrl: string | null
  thumbnailUrl: string | null
  /**
   * Free-form location string, e.g. `"High Point, NC"` or
   * `"Kippa-Ring, Australia"`. Empty string when the platform has no
   * location set for this user (common for hosts).
   */
  location: string
}

/**
 * Who sent the message — `host` or `guest`. Open string union to allow
 * future values (e.g. `co_host`, `agent`) without breaking consumers.
 */
export type MessageSenderType = 'host' | 'guest' | (string & {})

/**
 * Where the message originated. Values seen in production:
 *
 * - `hospitable` — sent via the Hospitable web app
 * - `platform` — sent via the upstream platform (Airbnb, VRBO, etc.)
 * - `automated` — triggered by a Hospitable rule/schedule
 * - `AI` — Hospitable's AI auto-reply feature
 * - `public_api` — sent via the Hospitable Public API (i.e. this SDK)
 *
 * Open string union so unobserved sources don't break consumers.
 */
export type MessageSource =
  | 'hospitable'
  | 'platform'
  | 'automated'
  | 'AI'
  | 'public_api'
  | (string & {})

/**
 * MIME-like content type. Only `text/plain` has been observed in the
 * wild, but this is a full MIME string field so the union is open.
 */
export type MessageContentType = 'text/plain' | (string & {})

export interface Message {
  id: number | string
  /** Booking platform, e.g. `airbnb`, `vrbo`, `booking_com`, `direct`. */
  platform: string
  /**
   * Upstream platform's message identifier. Distinct from {@link id}
   * (which is Hospitable's internal id). Useful for correlating against
   * platform webhooks or support tickets.
   */
  platformId: string
  conversationId: string
  reservationId: string
  /**
   * MIME content type of {@link body}. Currently always `text/plain`,
   * but the field exists to support future rich-content messages.
   */
  contentType: MessageContentType
  body: string
  attachments: MessageAttachment[]
  /**
   * Message reactions (emoji responses, etc.). Never observed populated
   * in probes — treat as opaque and narrow with a type guard if needed.
   */
  reactions: MessageReaction[]
  senderType: MessageSenderType
  /** Sender's role on the conversation (e.g. `host`). May be `null`. */
  senderRole: string | null
  sender: MessageSender
  createdAt: string
  source: MessageSource
  /**
   * Third-party integration metadata — for messages routed through
   * external tools. Almost always `null` for messages sent directly
   * through Hospitable or platforms. Shape is opaque until we see a
   * populated example.
   */
  integration: unknown | null
  /**
   * Correlates with {@link MessageReceipt.sentReferenceId} from a
   * previous `send()` call. `null` for messages the SDK didn't send.
   * Use this to confirm async delivery of messages sent via the API.
   */
  sentReferenceId: string | null
}

export interface MessageThread {
  reservationId: string
  messages: Message[]
}

/**
 * Options accepted by both reservation and inquiry send endpoints.
 * The `senderId` is the co-host user id — leave blank to send as the listing
 * owner. Only supported on Airbnb reservations per the upstream API.
 */
export interface SendMessageOptions {
  senderId?: string
}

/**
 * Reservation-only extension of {@link SendMessageOptions}. The reservation
 * send endpoint additionally accepts an `images` array of URLs to attach
 * photos to the message. Inquiry send does NOT support image attachments —
 * pre-booking channels reject them — so this field is intentionally excluded
 * from {@link SendMessageOptions}.
 */
export interface SendReservationMessageOptions extends SendMessageOptions {
  /** URLs of images to attach to the message. */
  images?: string[]
}

/**
 * Async receipt returned by the `POST /v2/inquiries/{uuid}/messages` and
 * `POST /v2/reservations/{uuid}/messages` endpoints.
 *
 * Both endpoints respond with 202 Accepted — delivery happens out of band on
 * the upstream channel (Airbnb / VRBO / etc). Match `sentReferenceId` against
 * the `sentReferenceId` field of Message resources fetched afterwards to
 * confirm delivery landed.
 */
export interface MessageReceipt {
  sentReferenceId: string
}

export interface MessageTemplate {
  id: string
  name: string
  body: string
  variables: string[]
}
