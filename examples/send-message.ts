import { HospitableClient } from '../src'

const client = new HospitableClient({ token: process.env['HOSPITABLE_PAT'] })

// Replace with a real reservation UUID
const RESERVATION_ID = 'your-reservation-uuid'

const message = await client.messages.send(
  RESERVATION_ID,
  'Hi! Looking forward to hosting you. Let me know if you have any questions.',
)
console.log('Message sent:', message.id)
