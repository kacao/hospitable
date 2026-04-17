import type { HttpClient } from '../../http/client'
import type { Channel, Listing } from '../models'

/**
 * Resource for the Connect Channels API. A Channel is an OTA connection
 * (currently Airbnb only) owned by a Customer. Channels aggregate
 * Listings and Reviews from the connected platform.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export class ChannelsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all channels a customer has connected.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers/{customer}/channels
   */
  async list(customerId: string): Promise<Channel[]> {
    const response = await this.http.get<{ data: Channel[] }>(
      `/customers/${encodeURIComponent(customerId)}/channels`,
    )
    return response.data
  }

  /**
   * Fetch a single channel by id, scoped to a customer.
   *
   * @see GET https://connect.hospitable.com/api/v1/customers/{customer}/channels/{channel}
   */
  async get(customerId: string, channelId: string): Promise<Channel> {
    const response = await this.http.get<{ data: Channel }>(
      `/customers/${encodeURIComponent(customerId)}/channels/${encodeURIComponent(channelId)}`,
    )
    return response.data
  }

  /**
   * Disconnect a channel from a customer.
   *
   * Note: this does **not** revoke the customer's authorization on the
   * OTA itself (e.g. the Airbnb account stays linked in the guest's
   * Airbnb app). It only severs Hospitable's sync with that channel.
   *
   * @see DELETE https://connect.hospitable.com/api/v1/customers/{customer}/channels/{channel}
   */
  async delete(customerId: string, channelId: string): Promise<void> {
    await this.http.delete<void>(
      `/customers/${encodeURIComponent(customerId)}/channels/${encodeURIComponent(channelId)}`,
    )
  }

  /**
   * List all listings published on a given channel. Excludes
   * unpublished or draft listings on the OTA side.
   *
   * @see GET https://connect.hospitable.com/api/v1/channels/{channel}/listings
   */
  async listListings(channelId: string): Promise<Listing[]> {
    const response = await this.http.get<{ data: Listing[] }>(
      `/channels/${encodeURIComponent(channelId)}/listings`,
    )
    return response.data
  }

  /**
   * Fetch a single listing scoped to a channel.
   *
   * @see GET https://connect.hospitable.com/api/v1/channels/{channel}/listings/{listing}
   */
  async getListing(channelId: string, listingId: string): Promise<Listing> {
    const response = await this.http.get<{ data: Listing }>(
      `/channels/${encodeURIComponent(channelId)}/listings/${encodeURIComponent(listingId)}`,
    )
    return response.data
  }
}
