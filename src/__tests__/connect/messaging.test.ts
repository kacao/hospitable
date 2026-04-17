import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessagingResource } from '../../connect/resources/messaging'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, MessageTemplate } from '../../connect/models'
import { ConfigurationError } from '../../errors'
import { makeHttpClient } from '../helpers'

const template: MessageTemplate = {
  id: 'tpl-1',
  message: 'Welcome {{name}}',
  placeholders: [
    { key: 'name', editable: true, description: 'Guest name', regex: null },
  ],
}

function listPage(
  data: MessageTemplate[],
): ConnectPaginatedResponse<MessageTemplate> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next: null },
    meta: { currentPage: 1, from: 1, to: data.length, path: 'p', perPage: 20 },
  }
}

describe('MessagingResource', () => {
  let http: HttpClient
  let resource: MessagingResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new MessagingResource(http)
  })

  it('listTemplates() calls GET /message-templates', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([template]))
    await resource.listTemplates()
    expect(http.get).toHaveBeenCalledWith('/message-templates', {})
  })

  it('getTemplate() unwraps data envelope', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: template })
    const result = await resource.getTemplate('tpl-1')
    expect(http.get).toHaveBeenCalledWith('/message-templates/tpl-1')
    expect(result).toEqual(template)
  })

  it('send() rejects when templateId is missing', async () => {
    await expect(
      // @ts-expect-error — deliberate missing field
      resource.send('res-1', { placeholders: { name: 'x' } }),
    ).rejects.toBeInstanceOf(ConfigurationError)
  })

  it('send() POSTs to /reservations/{r}/messages with body', async () => {
    vi.mocked(http.post).mockResolvedValue(undefined)
    await resource.send('res-1', {
      templateId: 'tpl-1',
      placeholders: { name: 'Sarah' },
    })
    expect(http.post).toHaveBeenCalledWith('/reservations/res-1/messages', {
      templateId: 'tpl-1',
      placeholders: { name: 'Sarah' },
    })
  })

  it('iterTemplates() yields each template across pages', async () => {
    vi.mocked(http.get).mockResolvedValueOnce(listPage([template]))
    const out: typeof template[] = []
    for await (const t of resource.iterTemplates()) out.push(t)
    expect(out).toEqual([template])
  })
})
