import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessagesResource } from '../resources/messages'
import type { HttpClient } from '../http/client'
import type { Message, MessageThread, MessageTemplate } from '../models/message'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    reservationId: 'res-1',
    direction: 'outbound',
    body: 'Hello guest',
    sentAt: '2026-02-25T10:00:00Z',
    readAt: null,
    senderName: 'Host',
    ...overrides,
  }
}

function makeThread(overrides: Partial<MessageThread> = {}): MessageThread {
  return {
    reservationId: 'res-1',
    messages: [],
    unreadCount: 0,
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
    it('calls GET /v2/reservations/{id}/messages', async () => {
      const thread = makeThread({ reservationId: 'res-42', messages: [makeMessage()] })
      vi.mocked(http.get).mockResolvedValue(thread)

      const result = await resource.list('res-42')

      expect(http.get).toHaveBeenCalledWith('/v2/reservations/res-42/messages')
      expect(result).toBe(thread)
    })
  })

  describe('send()', () => {
    it('calls POST with { body } payload and returns Message', async () => {
      const msg = makeMessage({ body: 'Check-in info' })
      vi.mocked(http.post).mockResolvedValue(msg)

      const result = await resource.send('res-42', 'Check-in info')

      expect(http.post).toHaveBeenCalledWith(
        '/v2/reservations/res-42/messages',
        { body: 'Check-in info' },
      )
      expect(result).toBe(msg)
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
      vi.mocked(http.post).mockResolvedValue(msg)

      await resource.sendTemplate('res-42', 'tpl-1')

      expect(http.post).toHaveBeenCalledWith(
        '/v2/reservations/res-42/messages/template',
        { templateId: 'tpl-1', variables: {} },
      )
    })

    it('passes variables through correctly', async () => {
      const msg = makeMessage()
      vi.mocked(http.post).mockResolvedValue(msg)

      await resource.sendTemplate('res-42', 'tpl-1', { name: 'Alice', checkin: '2026-03-01' })

      expect(http.post).toHaveBeenCalledWith(
        '/v2/reservations/res-42/messages/template',
        { templateId: 'tpl-1', variables: { name: 'Alice', checkin: '2026-03-01' } },
      )
    })
  })
})
