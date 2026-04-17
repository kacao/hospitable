/**
 * A placeholder in a {@link MessageTemplate}. Partners fill these when
 * sending a message — `key` names the slot (`'discount'`, `'url'`,
 * etc.); `editable` indicates whether the partner can override the
 * default; `regex` (if present) constrains the value shape.
 */
export interface MessagePlaceholder {
  key: string
  editable: boolean
  description: string | null
  regex: string | null
}

/**
 * A custom message template configured in the Hospitable Partner Portal.
 * `message` is the template body with `{{placeholder}}` tokens matching
 * `placeholders[].key`.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface MessageTemplate {
  id: string
  message: string
  placeholders: MessagePlaceholder[]
}

/**
 * Request body for `POST /reservations/{reservation}/messages`. Pass
 * `templateId` to render against a stored template, then supply values
 * for each editable `placeholder` keyed by `key`.
 *
 * Example:
 * ```ts
 * {
 *   templateId: '8bb28...',
 *   placeholders: { url: 'https://example.com', discount: '10%' }
 * }
 * ```
 */
export interface SendMessageInput {
  templateId: string
  placeholders?: Record<string, string>
}
