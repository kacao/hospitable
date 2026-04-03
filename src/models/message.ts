export interface MessageSender {
  firstName: string
  fullName: string
  locale: string
  pictureUrl: string | null
  thumbnailUrl: string | null
}

export interface Message {
  id: number | string
  platform: string
  conversationId: string
  reservationId: string
  body: string
  senderType: string
  senderRole: string | null
  sender: MessageSender
  createdAt: string
  source: string
  sentReferenceId: string | null
  attachments: unknown[]
}

export interface MessageThread {
  reservationId: string
  messages: Message[]
}

export interface SendMessageRequest {
  body: string
}

export interface MessageTemplate {
  id: string
  name: string
  body: string
  variables: string[]
}
