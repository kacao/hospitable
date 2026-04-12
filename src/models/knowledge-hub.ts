/**
 * A data source that contributed content to the Knowledge Hub — e.g. inbox
 * auto-detection, manual entry, or a third-party integration.
 *
 * @see GET https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub
 */
export interface KnowledgeHubSource {
  id: number
  type: string
  name: string
  state: string
  editable: boolean
  parsedAt: string
  metadata: unknown[]
}

/**
 * A single knowledge item within a {@link KnowledgeHubTopic}. Items are
 * the atomic pieces of information the AI draws on when composing guest
 * replies.
 */
export interface KnowledgeHubItem {
  id: number
  content: string
  originalContent: string | null
  isEdited: boolean
  state: string
  createdVia: string | null
  lastUpdatedVia: string | null
  sources: KnowledgeHubSource[]
  updatedAt: string
}

/**
 * A topic grouping within the Knowledge Hub — e.g. "Local Attractions",
 * "Check-in Instructions", "Pool Rules". Each topic contains one or more
 * {@link KnowledgeHubItem} entries.
 */
export interface KnowledgeHubTopic {
  id: number
  name: string
  createdVia: string | null
  lastUpdatedVia: string | null
  aggregateItems: KnowledgeHubItem[]
  updatedAt: string
}

/** Property summary embedded in the Knowledge Hub response. */
export interface KnowledgeHubProperty {
  id: number
  name: string
  picture: string
}

/**
 * Full Knowledge Hub payload for a property — topics, items, and sources.
 *
 * @see GET https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub
 */
export interface KnowledgeHub {
  property: KnowledgeHubProperty
  sources: KnowledgeHubSource[]
  topics: KnowledgeHubTopic[]
}

/**
 * Options for creating a Knowledge Hub item.
 *
 * Supply either `topicId` (to append to an existing topic) or `topicName`
 * (to create a new topic and add the item under it). If both are provided,
 * `topicId` takes precedence on the API side.
 *
 * @see POST https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub/items
 */
export interface CreateKnowledgeHubItemOptions {
  topicId?: number
  topicName?: string
}

/**
 * Options for updating a Knowledge Hub item.
 *
 * @see PUT https://public.api.hospitable.com/v2/properties/{id}/knowledge-hub/items/{itemId}
 */
export interface UpdateKnowledgeHubItemOptions {
  topicId?: number
  topicName?: string
}
