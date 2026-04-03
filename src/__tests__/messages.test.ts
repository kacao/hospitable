import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessagesResource } from '../resources/messages'
import type { HttpClient } from '../http/client'
import type { Message, MessageTemplate } from '../models/message'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    platform: 'airbnb',
    conversationId: 'conv-1',
    reservationId: 'res-1',
    body: 'Hello guest',
    senderType: 'host',
    senderRole: null,
    sender: {
      firstName: 'Host',
      fullName: 'Host Name',
      locale: 'en',
      pictureUrl: null,
      thumbnailUrl: null,
    },
    createdAt: '2026-02-25T10:00:00Z',
    source: 'hospitable',
    sentReferenceId: null,
    attachments: [],
    ...overrides,
  }
}

function makeTemplate(overrides: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: 'tpl-1',
    name: 'Welcome',
    body: 'Welcome {{name}}!',
    variables: ['name'],
    ...overrides,
  }
}

function makeHttpClient(): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  } as unknown as HttpClient
}

describe('MessagesResource', () => {
  let http: HttpClient
  let resource: MessagesResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new MessagesResource(http)
  })

  describe('list()', () => {
    it('calls GET /v2/reservations/{id}/messages and unwraps .data', async () => {
      const messages = [makeMessage()]
      vi.mocked(http.get).mockResolvedValue({ data: messages })

      const result = await resource.list('res-42')

      expect(http.get).toHaveBeenCalledWith('/v2/reservations/res-42/messages')
      expect(result).toEqual({ reservationId: 'res-42', messages })
    })

    it('returns empty messages array when response.data is undefined', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: undefined })

      const result = await resource.list('res-42')

      expect(result).toEqual({ reservationId: 'res-42', messages: [] })
    })
  })

  describe('send()', () => {
    it('calls POST with { body } payload and unwraps .data', async () => {
      const msg = makeMessage({ body: 'Check-in info' })
      vi.mocked(http.post).mockResolvedValue({ data: msg })

      const result = await resource.send('res-42', 'Check-in info')

      expect(http.post).toHaveBeenCalledWith(
        '/v2/reservations/res-42/messages',
        { body: 'Check-in info' },
      )
      expect(result).toEqual(msg)
    })
  })

  describe('listTemplates()', () => {
    it('calls GET /v2/message-templates and unwraps .data', async () => {
      const templates = [makeTemplate({ id: 'tpl-1' }), makeTemplate({ id: 'tpl-2' })]
      vi.mocked(http.get).mockResolvedValue({ data: templates })

      const result = await resource.listTemplates()

      expect(http.get).toHaveBeenCalledWith('/v2/message-templates')
      expect(result).toEqual(templates)
    })
  })

  describe('sendTemplate()', () => {
    it('calls POST with { templateId, variables: {} } when no variables provided', async () => {
      const msg = makeMessage()
      vi.mocked(http.post).mockResolvedValue({ data: msg })

      await resource.sendTemplate('res-42', 'tpl-1')

      expect(http.post).toHaveBeenCalledWith(
        '/v2/reservations/res-42/messages/template',
        { templateId: 'tpl-1', variables: {} },
      )
    })

    it('passes variables through correctly', async () => {
      const msg = makeMessage()
      vi.mocked(http.post).mockResolvedValue({ data: msg })

      await resource.sendTemplate('res-42', 'tpl-1', { name: 'Alice', checkin: '2026-03-01' })

      expect(http.post).toHaveBeenCalledWith(
        '/v2/reservations/res-42/messages/template',
        { templateId: 'tpl-1', variables: { name: 'Alice', checkin: '2026-03-01' } },
      )
    })
  })
})
