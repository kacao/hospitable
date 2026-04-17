import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResolutionsResource } from '../../connect/resources/resolutions'
import type { HttpClient } from '../../http/client'
import type { ConnectPaginatedResponse, Resolution } from '../../connect/models'
import { makeHttpClient } from '../helpers'

const resolution = { id: 'rz-1' } as unknown as Resolution

function listPage(data: Resolution[]): ConnectPaginatedResponse<Resolution> {
  return {
    data,
    links: { first: 'u', last: null, prev: null, next: null },
    meta: { currentPage: 1, from: 1, to: data.length, path: 'p', perPage: 20 },
  }
}

describe('ResolutionsResource', () => {
  let http: HttpClient
  let resource: ResolutionsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new ResolutionsResource(http)
  })

  it('list() calls GET /channels/{ch}/resolutions', async () => {
    vi.mocked(http.get).mockResolvedValue(listPage([resolution]))
    await resource.list('ch-1')
    expect(http.get).toHaveBeenCalledWith('/channels/ch-1/resolutions', {})
  })

  it('iter() yields resolutions', async () => {
    vi.mocked(http.get).mockResolvedValueOnce(listPage([resolution]))
    const out: Resolution[] = []
    for await (const r of resource.iter('ch-1')) out.push(r)
    expect(out).toEqual([resolution])
  })
})
