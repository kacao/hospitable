import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChannelsResource } from '../../connect/resources/channels'
import type { HttpClient } from '../../http/client'
import type { Channel, Listing } from '../../connect/models'
import { makeHttpClient } from '../helpers'

const channel: Channel = {
  id: 'ch-1',
  platform: 'airbnb',
  platformId: '12345',
  name: 'Alice',
  picture: null,
  location: null,
  description: null,
  firstConnectedAt: '2026-01-01T00:00:00Z',
  readyToMigrate: null,
}

describe('ChannelsResource', () => {
  let http: HttpClient
  let resource: ChannelsResource

  beforeEach(() => {
    http = makeHttpClient()
    resource = new ChannelsResource(http)
  })

  it('list() calls GET /customers/{c}/channels and returns unwrapped array', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [channel] })
    const result = await resource.list('cust-1')
    expect(http.get).toHaveBeenCalledWith('/customers/cust-1/channels')
    expect(result).toEqual([channel])
  })

  it('get() calls GET /customers/{c}/channels/{ch} and unwraps', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: channel })
    const result = await resource.get('cust-1', 'ch-1')
    expect(http.get).toHaveBeenCalledWith('/customers/cust-1/channels/ch-1')
    expect(result).toEqual(channel)
  })

  it('delete() calls DELETE /customers/{c}/channels/{ch}', async () => {
    vi.mocked(http.delete).mockResolvedValue(undefined)
    await resource.delete('cust-1', 'ch-1')
    expect(http.delete).toHaveBeenCalledWith('/customers/cust-1/channels/ch-1')
  })

  it('listListings() calls GET /channels/{ch}/listings and returns unwrapped array', async () => {
    const listing = { id: 'lst-1' } as unknown as Listing
    vi.mocked(http.get).mockResolvedValue({ data: [listing] })
    const result = await resource.listListings('ch-1')
    expect(http.get).toHaveBeenCalledWith('/channels/ch-1/listings')
    expect(result).toEqual([listing])
  })

  it('getListing() calls GET /channels/{ch}/listings/{l} and unwraps', async () => {
    const listing = { id: 'lst-1' } as unknown as Listing
    vi.mocked(http.get).mockResolvedValue({ data: listing })
    const result = await resource.getListing('ch-1', 'lst-1')
    expect(http.get).toHaveBeenCalledWith('/channels/ch-1/listings/lst-1')
    expect(result).toEqual(listing)
  })
})
