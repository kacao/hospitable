export type MessageDirection = 'outbound' | 'inbound'

export interface Message {
  id: string
  reservationId: string
  direction: MessageDirection
  body: string
  sentAt: string
  readAt: string | null
  senderName: string
}

export interface MessageThread {
  reservationId: string
  messages: Message[]
  unreadCount: number
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
