import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessagesResource } from '../resources/messages'
import type { HttpClient } from '../http/client'
import { HospitableError, NotFoundError, RateLimitError } from '../errors'
import type {
  Message,
  MessageSource,
  MessageTemplate,
  MessageReceipt,
} from '../models/message'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    platform: 'airbnb',
    platformId: 'plat-msg-1',
    conversationId: 'conv-1',
    reservationId: 'res-1',
    contentType: 'text/plain',
    body: 'Hello guest',
    senderType: 'host',
    senderRole: null,
    sender: {
      firstName: 'Host',
      fullName: 'Host Name',
      locale: 'en',
      pictureUrl: null,
      thumbnailUrl: null,
      location: '',
    },
    createdAt: '2026-02-25T10:00:00Z',
    source: 'hospitable',
    integration: null,
    sentReferenceId: null,
    attachments: [],
    reactions: [],
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

    it('throws NotFoundError when the reservation does not exist', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Reservation not found', 'req-1'))

      await expect(resource.list('res-missing')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(15, 'req-rl'))

      const err = await resource.list('res-42').catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(15)
    })

    it('preserves platformId on returned messages', async () => {
      const msg = makeMessage({ platformId: 'airbnb-27256560910' })
      vi.mocked(http.get).mockResolvedValue({ data: [msg] })

      const result = await resource.list('res-42')

      expect(result.messages[0]!.platformId).toBe('airbnb-27256560910')
    })

    it('preserves contentType field (default text/plain)', async () => {
      const msg = makeMessage()
      vi.mocked(http.get).mockResolvedValue({ data: [msg] })

      const result = await resource.list('res-42')

      expect(result.messages[0]!.contentType).toBe('text/plain')
    })

    it('deserializes structured image attachments', async () => {
      const msg = makeMessage({
        attachments: [
          { type: 'image', url: 'https://airbnb.s3.amazonaws.com/photo.png?sig=abc' },
        ],
      })
      vi.mocked(http.get).mockResolvedValue({ data: [msg] })

      const result = await resource.list('res-42')
      const attachment = result.messages[0]!.attachments[0]!

      expect(attachment.type).toBe('image')
      expect(attachment.url).toContain('airbnb.s3')
    })

    it('preserves reactions array (opaque, empty by default)', async () => {
      const msg = makeMessage({ reactions: [] })
      vi.mocked(http.get).mockResolvedValue({ data: [msg] })

      const result = await resource.list('res-42')

      expect(result.messages[0]!.reactions).toEqual([])
    })

    it('preserves integration field (null by default)', async () => {
      const msg = makeMessage({ integration: null })
      vi.mocked(http.get).mockResolvedValue({ data: [msg] })

      const result = await resource.list('res-42')

      expect(result.messages[0]!.integration).toBe(null)
    })

    it('preserves sender.location on returned messages', async () => {
      const msg = makeMessage({
        sender: {
          firstName: 'Dave',
          fullName: 'Dave McGrath',
          locale: 'en',
          pictureUrl: null,
          thumbnailUrl: null,
          location: 'Kippa-Ring, Australia',
        },
      })
      vi.mocked(http.get).mockResolvedValue({ data: [msg] })

      const result = await resource.list('res-42')

      expect(result.messages[0]!.sender.location).toBe('Kippa-Ring, Australia')
    })

    it('exposes all known message sources as string-compatible values', async () => {
      // Regression guard: the source union includes hospitable, platform,
      // automated, AI, public_api. Typed via the imported `MessageSource`
      // union — if someone removes one of the five literals from the
      // union, this file breaks at compile time because the array
      // initializer would no longer satisfy `readonly MessageSource[]`.
      //
      // DO NOT inline the union as Array<'hospitable' | ...> here — that
      // would hide union drift and defeat the guard entirely.
      const sources: readonly MessageSource[] = [
        'hospitable',
        'platform',
        'automated',
        'AI',
        'public_api',
      ]
      const messages = sources.map((s, i) => makeMessage({ id: `msg-${i}`, source: s }))
      vi.mocked(http.get).mockResolvedValue({ data: messages })

      const result = await resource.list('res-42')
      expect(result.messages.map((m) => m.source)).toEqual(sources)
    })
  })

  describe('send()', () => {
    const receipt: MessageReceipt = {
      sentReferenceId: '2d637b98-2e20-470e-a582-83c4304d48a8',
    }

    it('calls POST /v2/reservations/{uuid}/messages with { body } payload', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: receipt })

      const result = await resource.send('res-42', 'Check-in info')

      expect(http.post).toHaveBeenCalledWith(
        '/v2/reservations/res-42/messages',
        { body: 'Check-in info' },
      )
      expect(result).toBe(receipt)
      expect(result.sentReferenceId).toBe('2d637b98-2e20-470e-a582-83c4304d48a8')
    })

    it('includes senderId in the payload when provided', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: receipt })

      await resource.send('res-42', 'Hi', { senderId: 'cohost-1' })

      expect(http.post).toHaveBeenCalledWith('/v2/reservations/res-42/messages', {
        body: 'Hi',
        senderId: 'cohost-1',
      })
    })

    it('includes images in the payload when provided', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: receipt })

      await resource.send('res-42', 'Here are the pics', {
        images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      })

      expect(http.post).toHaveBeenCalledWith('/v2/reservations/res-42/messages', {
        body: 'Here are the pics',
        images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      })
    })

    it('allows combining images and senderId', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: receipt })

      await resource.send('res-42', 'body', {
        senderId: 'cohost-1',
        images: ['https://example.com/x.jpg'],
      })

      expect(http.post).toHaveBeenCalledWith('/v2/reservations/res-42/messages', {
        body: 'body',
        senderId: 'cohost-1',
        images: ['https://example.com/x.jpg'],
      })
    })
  })

  describe('sendForInquiry()', () => {
    const receipt: MessageReceipt = {
      sentReferenceId: '2d637b98-2e20-470e-a582-83c4304d48a8',
    }

    it('calls POST /v2/inquiries/{uuid}/messages with { body } payload', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: receipt })

      const result = await resource.sendForInquiry(
        '6f58fd0a-a9cb-3746-9219-384a156ff7bb',
        'Thanks for the question!',
      )

      expect(http.post).toHaveBeenCalledWith(
        '/v2/inquiries/6f58fd0a-a9cb-3746-9219-384a156ff7bb/messages',
        { body: 'Thanks for the question!' },
      )
      expect(result).toBe(receipt)
      expect(result.sentReferenceId).toBe('2d637b98-2e20-470e-a582-83c4304d48a8')
    })

    it('includes senderId in the payload when provided', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: receipt })

      await resource.sendForInquiry('inquiry-uuid', 'Hi there', { senderId: 'cohost-1' })

      expect(http.post).toHaveBeenCalledWith('/v2/inquiries/inquiry-uuid/messages', {
        body: 'Hi there',
        senderId: 'cohost-1',
      })
    })

    it('omits senderId from the payload when not provided', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: receipt })

      await resource.sendForInquiry('inquiry-uuid', 'Hi there')

      expect(http.post).toHaveBeenCalledWith('/v2/inquiries/inquiry-uuid/messages', {
        body: 'Hi there',
      })
    })

    it('propagates 410 Gone as a HospitableError when the inquiry has been deleted', async () => {
      // 410 is mapped to ServerError by createErrorFromResponse (it's the
      // default branch), so callers match via the base HospitableError class
      // plus statusCode to distinguish inquiry-deleted from other errors.
      vi.mocked(http.post).mockRejectedValue(new HospitableError('Gone', 410, 'req-gone'))

      const err = await resource.sendForInquiry('deleted-inquiry', 'body').catch((e) => e)
      expect(err).toBeInstanceOf(HospitableError)
      expect(err.statusCode).toBe(410)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(60, 'req-rl'))

      const err = await resource.sendForInquiry('inquiry-uuid', 'body').catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.statusCode).toBe(429)
      expect((err as RateLimitError).retryAfter).toBe(60)
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

    it('propagates HospitableError from the HTTP layer', async () => {
      vi.mocked(http.get).mockRejectedValue(new HospitableError('Forbidden', 403, 'req-1'))

      const err = await resource.listTemplates().catch((e) => e)
      expect(err).toBeInstanceOf(HospitableError)
      expect(err.statusCode).toBe(403)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(20, 'req-rl'))

      const err = await resource.listTemplates().catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(20)
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

    it('throws NotFoundError when the reservation or template does not exist', async () => {
      vi.mocked(http.post).mockRejectedValue(new NotFoundError('Template not found', 'req-1'))

      await expect(
        resource.sendTemplate('res-42', 'tpl-missing'),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError surfaced by the retry layer', async () => {
      vi.mocked(http.post).mockRejectedValue(new RateLimitError(90, 'req-rl'))

      const err = await resource.sendTemplate('res-42', 'tpl-1').catch((e) => e)
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(90)
    })
  })
})
