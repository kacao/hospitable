import type { HttpClient, RequestOptions } from '../../http/client'
import { paginateConnect } from '../paginate'
import { ConfigurationError } from '../../errors'
import type {
  ConnectPaginatedResponse,
  MessageTemplate,
  SendMessageInput,
} from '../models'

export interface MessageTemplateListParams {
  page?: number
  perPage?: number
  _select?: string
}

/**
 * Resource for the Connect Messaging API. Messages are sent via
 * **pre-configured templates** — freeform text is not supported.
 * Configure templates in the Partner Portal, then reference them by
 * `templateId` when sending.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class MessagingResource {
  constructor(private readonly http: HttpClient) {}

  private fetchTemplates(
    params: MessageTemplateListParams,
  ): Promise<ConnectPaginatedResponse<MessageTemplate>> {
    return this.http.get<ConnectPaginatedResponse<MessageTemplate>>(
      '/message-templates',
      params as RequestOptions['params'],
    )
  }

  /**
   * List all message templates available to this vendor.
   *
   * @see GET https://connect.hospitable.com/api/v1/message-templates
   */
  async listTemplates(
    params: MessageTemplateListParams = {},
  ): Promise<ConnectPaginatedResponse<MessageTemplate>> {
    return this.fetchTemplates(params)
  }

  /** Stream every template, auto-paginating. */
  async *iterTemplates(
    params: Omit<MessageTemplateListParams, 'page'> = {},
  ): AsyncGenerator<MessageTemplate> {
    yield* paginateConnect<MessageTemplate, MessageTemplateListParams>(
      p => this.fetchTemplates(p),
      params,
    )
  }

  /**
   * Fetch a single template by id.
   *
   * @see GET https://connect.hospitable.com/api/v1/message-templates/{template}
   */
  async getTemplate(templateId: string): Promise<MessageTemplate> {
    const response = await this.http.get<{ data: MessageTemplate }>(
      `/message-templates/${encodeURIComponent(templateId)}`,
    )
    return response.data
  }

  /**
   * Send a templated message to the guest on a reservation. Placeholder
   * values are substituted into the template body; the rendered message
   * appears in the guest's OTA inbox.
   *
   * @see POST https://connect.hospitable.com/api/v1/reservations/{reservation}/messages
   * @throws {ConfigurationError} when `templateId` is missing
   */
  async send(reservationId: string, input: SendMessageInput): Promise<void> {
    if (!input.templateId) {
      throw new ConfigurationError(
        'messaging.send: `templateId` is required. ' +
          'Freeform messages are not supported — configure a template in the Partner Portal.',
      )
    }
    await this.http.post<void>(
      `/reservations/${encodeURIComponent(reservationId)}/messages`,
      input,
    )
  }
}
