import { HospitableClient } from './src'

const token = process.env.HOSPITABLE_ACCESS_TOKEN!
const client = new HospitableClient({ token, debug: true })

client.reservations.list({ perPage: 1 })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => console.error('status:', e.statusCode, 'message:', e.message))
