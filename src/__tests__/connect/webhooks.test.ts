import { describe, it, expect } from 'vitest'
import {
  isConnectWebhookAction,
  isConnectWebhookFamily,
  type ConnectWebhookPayload,
  type ReservationWebhookPayload,
} from '../../connect/webhooks'

const reservationPayload: ReservationWebhookPayload = {
  id: '01H3',
  created: '2026-04-16T00:00:00Z',
  action: 'reservation.created',
  version: '2023-03-02',
  // shape only — tests are about envelope + guards, not field coverage
  data: {} as ReservationWebhookPayload['data'],
}

const reviewPayload: ConnectWebhookPayload = {
  id: '01H4',
  created: '2026-04-16T00:00:00Z',
  action: 'review.published',
  version: '2023-03-02',
  data: {} as ConnectWebhookPayload['data'],
} as ConnectWebhookPayload

describe('Connect webhook type guards', () => {
  it('isConnectWebhookAction narrows to the exact action', () => {
    const p: ConnectWebhookPayload = reservationPayload
    if (isConnectWebhookAction(p, 'reservation.created')) {
      // Should type-narrow to ReservationWebhookPayload at compile time
      expect(p.action).toBe('reservation.created')
    } else {
      expect.unreachable()
    }
  })

  it('isConnectWebhookAction returns false for mismatched action', () => {
    expect(isConnectWebhookAction(reservationPayload, 'review.created')).toBe(false)
  })

  it('isConnectWebhookFamily matches by prefix', () => {
    expect(isConnectWebhookFamily(reservationPayload, 'reservation')).toBe(true)
    expect(isConnectWebhookFamily(reservationPayload, 'review')).toBe(false)
    expect(isConnectWebhookFamily(reviewPayload, 'review')).toBe(true)
  })

  it('envelope carries id/created/action/version/data', () => {
    expect(reservationPayload).toHaveProperty('id')
    expect(reservationPayload).toHaveProperty('created')
    expect(reservationPayload).toHaveProperty('action')
    expect(reservationPayload).toHaveProperty('version')
    expect(reservationPayload).toHaveProperty('data')
  })
})
