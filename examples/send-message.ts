import { HospitableClient } from '../src'

const client = new HospitableClient({ token: process.env['HOSPITABLE_API_PAT'] })

// Replace with a real reservation UUID
const RESERVATION_ID = 'your-reservation-uuid'

// The API returns 202 Accepted with an async receipt. Match `sentReferenceId`
// against messages fetched via `client.messages.list(RESERVATION_ID)` later
// to confirm delivery landed on the upstream channel (Airbnb, VRBO, etc).
const receipt = await client.messages.send(
  RESERVATION_ID,
  'Hi! Looking forward to hosting you. Let me know if you have any questions.',
  { images: ['https://example.com/checkin-instructions.jpg'] },
)
console.log('Message queued:', receipt.sentReferenceId)
