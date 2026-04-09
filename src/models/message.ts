export interface MessageSender {
  firstName: string
  fullName: string
  locale: string
  pictureUrl: string | null
  thumbnailUrl: string | null
}

export interface Message {
  id: number | string
  platform: string
  conversationId: string
  reservationId: string
  body: string
  senderType: string
  senderRole: string | null
  sender: MessageSender
  createdAt: string
  source: string
  sentReferenceId: string | null
  attachments: unknown[]
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
