import type { HttpClient } from '../http/client'
import type {
  KnowledgeHub,
  KnowledgeHubItem,
  CreateKnowledgeHubItemOptions,
  UpdateKnowledgeHubItemOptions,
} from '../models/knowledge-hub'

/**
 * Resource for the Hospitable Knowledge Hub API.
 *
 * The Knowledge Hub stores structured Q&A content that the Hospitable AI
 * draws on when composing guest replies. Content is organized by
 * property, grouped into topics, and broken into individual items.
 *
 * @see GET https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub
 */
export class KnowledgeHubResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch the full Knowledge Hub for a property — topics, items, and sources.
   *
   * @see GET https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub
   */
  async get(propertyUuid: string): Promise<KnowledgeHub> {
    const response = await this.http.get<{ data: KnowledgeHub }>(
      `/v2/properties/${encodeURIComponent(propertyUuid)}/knowledge-hub`,
    )
    return response.data
  }

  /**
   * Create a new Knowledge Hub item under an existing or new topic.
   *
   * Pass `topicId` to append to an existing topic, or `topicName` to
   * create a new topic and add the item under it.
   *
   * @see POST https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub/items
   */
  async createItem(
    propertyUuid: string,
    content: string,
    options?: CreateKnowledgeHubItemOptions,
  ): Promise<KnowledgeHubItem> {
    const response = await this.http.post<{ data: KnowledgeHubItem }>(
      `/v2/properties/${encodeURIComponent(propertyUuid)}/knowledge-hub/items`,
      { content, ...options },
    )
    return response.data
  }

  /**
   * Update an existing Knowledge Hub item's content and/or topic assignment.
   *
   * @see PUT https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub/items/{itemId}
   */
  async updateItem(
    propertyUuid: string,
    itemId: number,
    content: string,
    options?: UpdateKnowledgeHubItemOptions,
  ): Promise<KnowledgeHubItem> {
    const response = await this.http.put<{ data: KnowledgeHubItem }>(
      `/v2/properties/${encodeURIComponent(propertyUuid)}/knowledge-hub/items/${encodeURIComponent(String(itemId))}`,
      { content, ...options },
    )
    return response.data
  }

  /**
   * Delete a Knowledge Hub item.
   *
   * @see DELETE https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub/items/{itemId}
   */
  async deleteItem(propertyUuid: string, itemId: number): Promise<void> {
    await this.http.delete<void>(
      `/v2/properties/${encodeURIComponent(propertyUuid)}/knowledge-hub/items/${encodeURIComponent(String(itemId))}`,
    )
  }

  /**
   * Delete an entire Knowledge Hub topic and all its items.
   *
   * @see DELETE https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub/topics/{topicId}
   */
  async deleteTopic(propertyUuid: string, topicId: number): Promise<void> {
    await this.http.delete<void>(
      `/v2/properties/${encodeURIComponent(propertyUuid)}/knowledge-hub/topics/${encodeURIComponent(String(topicId))}`,
    )
  }
}
