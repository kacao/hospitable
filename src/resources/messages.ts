import type { HttpClient } from '../http/client'
import type {
  Message,
  MessageThread,
  MessageTemplate,
  MessageReceipt,
  SendMessageOptions,
  SendReservationMessageOptions,
} from '../models/message'

/**
 * Resource for reading and sending messages on reservations and inquiries.
 *
 * **Which send method to use?**
 *
 * | Conversation state                       | Call                                     |
 * | ---------------------------------------- | ---------------------------------------- |
 * | `reservation.id` known (booking exists)  | {@link send} — accepts `images` attachments |
 * | `inquiry.id` known, no reservation yet   | {@link sendForInquiry} — no `images`     |
 *
 * Calling the wrong endpoint returns 410 or 422. Since `inquiry.id ===
 * conversation_id`, reading a message thread works the same for both:
 * `client.messages.list(reservationOrInquiryId)`.
 *
 * Both send methods return `202 Accepted` with a `MessageReceipt` —
 * delivery happens out-of-band on the upstream channel (Airbnb, VRBO,
 * Booking.com, direct). Persist `receipt.sentReferenceId` and match it
 * against `Message.sentReferenceId` on a subsequent `list()` to confirm.
 *
 * Rate limits (both endpoints): **2/minute per target**, **50 per 5
 * minutes globally**. The retry layer handles 429 automatically.
 */
export class MessagesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the message thread for a reservation.
   *
   * @see GET https://public.api.hospitable.com/v2/reservations/{uuid}/messages
   */
  async list(reservationId: string): Promise<MessageThread> {
    const response = await this.http.get<{ data: Message[] }>(`/v2/reservations/${reservationId}/messages`)
    return {
      reservationId,
      messages: response.data ?? [],
    }
  }

  /**
   * Send a message on a reservation.
   *
   * Returns an async receipt with a `sentReferenceId` — the API responds with
   * 202 Accepted and delivers asynchronously on the upstream channel. Match
   * the `sentReferenceId` against messages fetched via {@link list} afterwards
   * to confirm delivery landed.
   *
   * Rate limits: 2/minute per reservation, 50 per 5 minutes globally. The
   * SDK's retry layer handles 429 responses automatically.
   *
   * @see POST https://public.api.hospitable.com/v2/reservations/{uuid}/messages
   */
  async send(
    reservationId: string,
    body: string,
    options?: SendReservationMessageOptions,
  ): Promise<MessageReceipt> {
    const payload: { body: string } & SendReservationMessageOptions = { body, ...options }
    const response = await this.http.post<{ data: MessageReceipt }>(
      `/v2/reservations/${reservationId}/messages`,
      payload,
    )
    return response.data
  }

  /**
   * Send a message on an inquiry (pre-booking conversation).
   *
   * The `inquiryUuid` is the conversation_id — same as `inquiry.id`. Use this
   * endpoint when a conversation exists but hasn't yet produced a reservation
   * (i.e. the guest is still in the "inquiry" stage). Once it becomes a
   * reservation, switch to {@link send} instead.
   *
   * Returns an async receipt with a `sentReferenceId` — match it against the
   * `sentReferenceId` on Message resources fetched afterwards to correlate
   * delivery on upstream channels (Airbnb, VRBO, etc).
   *
   * Rate limits: 2/minute per inquiry, 50 per 5 minutes globally.
   *
   * @see POST https://public.api.hospitable.com/v2/inquiries/{uuid}/messages
   * @throws {HospitableError} 410 if the inquiry has been deleted upstream.
   * @throws {RateLimitError} 429 after retries are exhausted (`.retryAfter` in seconds).
   * @throws {ValidationError} 422 if the conversation has already become a reservation — use {@link send} instead.
   */
  async sendForInquiry(
    inquiryUuid: string,
    body: string,
    options?: SendMessageOptions,
  ): Promise<MessageReceipt> {
    const payload: { body: string } & SendMessageOptions = { body, ...options }
    const response = await this.http.post<{ data: MessageReceipt }>(
      `/v2/inquiries/${inquiryUuid}/messages`,
      payload,
    )
    return response.data
  }

  /**
   * List available message templates.
   *
   * @see GET https://public.api.hospitable.com/v2/message-templates
   */
  async listTemplates(): Promise<MessageTemplate[]> {
    const response = await this.http.get<{ data: MessageTemplate[] }>('/v2/message-templates')
    return response.data
  }

  /**
   * Send a message on a reservation using a message template.
   *
   * @see POST https://public.api.hospitable.com/v2/reservations/{uuid}/messages/template
   */
  async sendTemplate(
    reservationId: string,
    templateId: string,
    variables: Record<string, string> = {},
  ): Promise<Message> {
    const response = await this.http.post<{ data: Message }>(
      `/v2/reservations/${reservationId}/messages/template`,
      { templateId, variables },
    )
    return response.data
  }
}
