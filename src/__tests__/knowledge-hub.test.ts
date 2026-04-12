import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KnowledgeHubResource } from '../resources/knowledge-hub'
import type { HttpClient } from '../http/client'
import type { KnowledgeHub, KnowledgeHubItem } from '../models/knowledge-hub'
import { NotFoundError, RateLimitError, ValidationError } from '../errors'
import { makeHttpClient } from './helpers'

function makeKnowledgeHub(): KnowledgeHub {
  return {
    property: { id: 725232, name: 'Anaheim-D', picture: 'https://example.com/pic.jpg' },
    sources: [
      {
        id: 100839,
        type: 'inbox_swai_edit',
        name: 'Inbox (auto-detected)',
        state: 'ready',
        editable: false,
        parsedAt: '2025-05-19T19:41:34+00:00',
        metadata: [],
      },
    ],
    topics: [
      {
        id: 961595,
        name: 'Local Attractions',
        createdVia: null,
        lastUpdatedVia: null,
        aggregateItems: [
          {
            id: 1527918,
            content: 'The pool does not have specific usage hours.',
            originalContent: null,
            isEdited: false,
            state: 'ready',
            createdVia: null,
            lastUpdatedVia: null,
            sources: [],
            updatedAt: '2025-06-04T14:31:26.000000Z',
          },
        ],
        updatedAt: '2025-06-04T14:30:57.000000Z',
      },
    ],
  }
}

function makeItem(overrides: Partial<KnowledgeHubItem> = {}): KnowledgeHubItem {
  return {
    id: 1527918,
    content: 'The pool is open 24/7.',
    originalContent: null,
    isEdited: false,
    state: 'ready',
    createdVia: 'api',
    lastUpdatedVia: null,
    sources: [],
    updatedAt: '2025-06-04T14:31:26.000000Z',
    ...overrides,
  }
}

describe('KnowledgeHubResource', () => {
  let http: HttpClient
  let resource: KnowledgeHubResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new KnowledgeHubResource(http)
  })

  describe('get()', () => {
    it('calls GET /v2/properties/{id}/knowledge-hub and unwraps .data', async () => {
      const kb = makeKnowledgeHub()
      vi.mocked(http.get).mockResolvedValue({ data: kb })

      const result = await resource.get('prop-1')

      expect(http.get).toHaveBeenCalledWith(
        '/v2/properties/prop-1/knowledge-hub',
      )
      expect(result).toEqual(kb)
      expect(result.topics[0]!.name).toBe('Local Attractions')
    })

    it('encodes the property UUID in the URL', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: makeKnowledgeHub() })

      await resource.get('prop/special&id')

      expect(http.get).toHaveBeenCalledWith(
        '/v2/properties/prop%2Fspecial%26id/knowledge-hub',
      )
    })

    it('propagates NotFoundError on 404', async () => {
      vi.mocked(http.get).mockRejectedValue(new NotFoundError('Not found'))
      await expect(resource.get('missing')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propagates RateLimitError on 429', async () => {
      vi.mocked(http.get).mockRejectedValue(new RateLimitError(60))
      const err = (await resource.get('prop-1').catch((e) => e)) as RateLimitError
      expect(err).toBeInstanceOf(RateLimitError)
      expect(err.retryAfter).toBe(60)
    })
  })

  describe('createItem()', () => {
    it('calls POST with content and no options', async () => {
      const item = makeItem()
      vi.mocked(http.post).mockResolvedValue({ data: item })

      const result = await resource.createItem('prop-1', 'The pool is open 24/7.')

      expect(http.post).toHaveBeenCalledWith(
        '/v2/properties/prop-1/knowledge-hub/items',
        { content: 'The pool is open 24/7.' },
      )
      expect(result).toEqual(item)
    })

    it('calls POST with topicId option', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeItem() })

      await resource.createItem('prop-1', 'Pool info', { topicId: 961595 })

      expect(http.post).toHaveBeenCalledWith(
        '/v2/properties/prop-1/knowledge-hub/items',
        { content: 'Pool info', topicId: 961595 },
      )
    })

    it('calls POST with topicName option to create new topic', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: makeItem() })

      await resource.createItem('prop-1', 'Parking info', { topicName: 'Parking' })

      expect(http.post).toHaveBeenCalledWith(
        '/v2/properties/prop-1/knowledge-hub/items',
        { content: 'Parking info', topicName: 'Parking' },
      )
    })

    it('propagates ValidationError on 422', async () => {
      vi.mocked(http.post).mockRejectedValue(new ValidationError('Invalid', { content: ['required'] }))
      await expect(resource.createItem('prop-1', '')).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('updateItem()', () => {
    it('calls PUT with content and itemId in the path', async () => {
      const item = makeItem({ content: 'Updated content' })
      vi.mocked(http.put).mockResolvedValue({ data: item })

      const result = await resource.updateItem('prop-1', 1527918, 'Updated content')

      expect(http.put).toHaveBeenCalledWith(
        '/v2/properties/prop-1/knowledge-hub/items/1527918',
        { content: 'Updated content' },
      )
      expect(result.content).toBe('Updated content')
    })

    it('calls PUT with options to reassign topic', async () => {
      vi.mocked(http.put).mockResolvedValue({ data: makeItem() })

      await resource.updateItem('prop-1', 1527918, 'Content', { topicId: 999 })

      expect(http.put).toHaveBeenCalledWith(
        '/v2/properties/prop-1/knowledge-hub/items/1527918',
        { content: 'Content', topicId: 999 },
      )
    })

    it('encodes both propertyUuid and itemId in the URL', async () => {
      vi.mocked(http.put).mockResolvedValue({ data: makeItem() })

      await resource.updateItem('prop/special', 123, 'Content')

      expect(http.put).toHaveBeenCalledWith(
        '/v2/properties/prop%2Fspecial/knowledge-hub/items/123',
        { content: 'Content' },
      )
    })
  })

  describe('deleteItem()', () => {
    it('calls DELETE with propertyUuid and itemId in the path', async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined)

      await resource.deleteItem('prop-1', 1527918)

      expect(http.delete).toHaveBeenCalledWith(
        '/v2/properties/prop-1/knowledge-hub/items/1527918',
      )
    })

    it('returns void (no unwrap)', async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined)
      const result = await resource.deleteItem('prop-1', 1527918)
      expect(result).toBeUndefined()
    })

    it('propagates NotFoundError when item does not exist', async () => {
      vi.mocked(http.delete).mockRejectedValue(new NotFoundError('Not found'))
      await expect(resource.deleteItem('prop-1', 999999)).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('deleteTopic()', () => {
    it('calls DELETE with propertyUuid and topicId in the path', async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined)

      await resource.deleteTopic('prop-1', 961595)

      expect(http.delete).toHaveBeenCalledWith(
        '/v2/properties/prop-1/knowledge-hub/topics/961595',
      )
    })

    it('returns void', async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined)
      const result = await resource.deleteTopic('prop-1', 961595)
      expect(result).toBeUndefined()
    })

    it('propagates NotFoundError when topic does not exist', async () => {
      vi.mocked(http.delete).mockRejectedValue(new NotFoundError('Not found'))
      await expect(resource.deleteTopic('prop-1', 999999)).rejects.toBeInstanceOf(NotFoundError)
    })

    it('encodes propertyUuid and topicId in the path', async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined)

      await resource.deleteTopic('prop/special', 42)

      expect(http.delete).toHaveBeenCalledWith(
        '/v2/properties/prop%2Fspecial/knowledge-hub/topics/42',
      )
    })
  })
})
