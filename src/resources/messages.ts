import type { HttpClient } from '../http/client'
import type {
  Message,
  MessageThread,
  MessageTemplate,
  SendMessageRequest,
} from '../models/message'

export class MessagesResource {
  constructor(private readonly http: HttpClient) {}

  async list(reservationId: string): Promise<MessageThread> {
    const response = await this.http.get<{ data: Message[] }>(`/v2/reservations/${reservationId}/messages`)
    return {
      reservationId,
      messages: response.data ?? [],
    }
  }

  async send(reservationId: string, body: string): Promise<Message> {
    const payload: SendMessageRequest = { body }
    const response = await this.http.post<{ data: Message }>(`/v2/reservations/${reservationId}/messages`, payload)
    return response.data
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    const response = await this.http.get<{ data: MessageTemplate[] }>('/v2/message-templates')
    return response.data
  }

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
