// Empirically discovers the API surface area for endpoints the SDK
// currently implements. Sends deliberately-bogus params to each
// endpoint and prints the validation errors — Hospitable's API echoes
// the full list of allowed values, which lets us audit the SDK against
// reality without relying on Stoplight docs.

const token = process.env['HOSPITABLE_API_PAT']
if (!token) throw new Error('HOSPITABLE_API_PAT missing')
const BASE = 'https://public.api.hospitable.com'

const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

async function call(label: string, path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { headers, ...init })
  const body = await res.text()
  const pretty = (() => {
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return body.slice(0, 500)
    }
  })()
  console.log(`── ${label} ──\nGET ${path}\nHTTP ${res.status}\n${pretty}\n`)
}

// Grab one property ID so we can include-probe endpoints that need one
const propsRes = await fetch(`${BASE}/v2/properties`, { headers })
const { data: props } = (await propsRes.json()) as { data: Array<{ id: string }> }
const propId = props[0]!.id
console.log(`Using property ${propId}\n`)

// Reservations — probe dateQuery + include + status enums
await call('reservations: bogus include', `/v2/reservations?properties[]=${propId}&include=bogus`)
await call('reservations: bogus status', `/v2/reservations?properties[]=${propId}&status[]=bogus`)
await call('reservations: missing properties', `/v2/reservations`)

// Pull a real reservation with every include the SDK declares, plus `review`
await call(
  'reservations: max includes',
  `/v2/reservations?properties[]=${propId}&include=guest,user,financials,listings,properties,review&per_page=1`,
)

// Reviews
await call('reviews: bogus include', `/v2/properties/${propId}/reviews?include=bogus`)

// Properties
await call('properties: bogus include', `/v2/properties?include=bogus`)
await call('properties: single with bogus include', `/v2/properties/${propId}?include=bogus`)

// Calendar
const today = new Date().toISOString().split('T')[0]!
const future = new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0]!
await call(
  'calendar: happy path',
  `/v2/properties/${propId}/calendar?start_date=${today}&end_date=${future}`,
)
await call('calendar: missing dates', `/v2/properties/${propId}/calendar`)

// Messages — need a reservation ID
const rRes = await fetch(
  `${BASE}/v2/reservations?properties[]=${propId}&per_page=1`,
  { headers },
)
const { data: rs } = (await rRes.json()) as { data: Array<{ id: string }> }
if (rs[0]) {
  await call('messages: happy path', `/v2/reservations/${rs[0].id}/messages`)
}

// Inquiries
await call('inquiries: baseline', `/v2/inquiries`)
await call('inquiries: bogus include', `/v2/inquiries?include=bogus`)
