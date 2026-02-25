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
    return this.http.get<MessageThread>(`/v2/reservations/${reservationId}/messages`)
  }

  async send(reservationId: string, body: string): Promise<Message> {
    const payload: SendMessageRequest = { body }
    return this.http.post<Message>(`/v2/reservations/${reservationId}/messages`, payload)
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
    return this.http.post<Message>(
      `/v2/reservations/${reservationId}/messages/template`,
      { templateId, variables },
    )
  }
}
