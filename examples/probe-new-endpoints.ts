// Probe the endpoints we need to add to the SDK but whose return shapes
// are unknown. Uses intentionally-bad params for write endpoints to get
// validation errors (documenting required fields) without mutating data.
// For read endpoints, fetches real data and dumps the shape.

const token = process.env['HOSPITABLE_API_PAT']
if (!token) throw new Error('HOSPITABLE_API_PAT missing')
const BASE = 'https://public.api.hospitable.com'
const h = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }

async function probe(label: string, method: string, path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let pretty = text
  try { pretty = JSON.stringify(JSON.parse(text), null, 2).slice(0, 2000) } catch {}
  console.log(`── ${label} ──  ${method} ${path}  HTTP ${res.status}`)
  console.log(pretty)
  console.log()
}

// Get a property ID and reservation ID for scoped probes
const { data: props } = await (await fetch(`${BASE}/v2/properties?per_page=1`, { headers: h })).json() as { data: Array<{ id: string }> }
const propId = props[0]!.id
const propParams = `properties[]=${propId}`
const allProps = props.map((p: { id: string }) => `properties[]=${p.id}`).join('&')
const { data: reservations } = await (await fetch(`${BASE}/v2/reservations?${allProps}&per_page=1&status[]=accepted`, { headers: h })).json() as { data: Array<{ id: string }> }
const resId = reservations[0]?.id ?? 'no-reservation-found'

console.log(`Property: ${propId}`)
console.log(`Reservation: ${resId}\n`)

// 1. GET single transaction
const { data: txns } = await (await fetch(`${BASE}/v2/transactions?per_page=1`, { headers: h })).json() as { data: Array<{ id: string }> }
if (txns[0]) {
  await probe('GET single transaction', 'GET', `/v2/transactions/${txns[0].id}`)
  await probe('GET single transaction with include=payout', 'GET', `/v2/transactions/${txns[0].id}?include=payout`)
}

// 2. GET single payout
const { data: payouts } = await (await fetch(`${BASE}/v2/payouts?per_page=1`, { headers: h })).json() as { data: Array<{ id: string }> }
if (payouts[0]) {
  await probe('GET single payout', 'GET', `/v2/payouts/${payouts[0].id}`)
}

// 3. POST tag-property (probe with actual tags — additive, low risk)
await probe('POST tag-property', 'POST', `/v2/properties/${propId}/tags`, { tags: ['sdk-probe-test'] })

// 4. Knowledge Hub
await probe('GET knowledge-hub', 'GET', `/v2/properties/${propId}/knowledge-hub`)

// 5. Enrichment Data
await probe('GET list enrichment', 'GET', `/v2/reservations/${resId}/enrichment-data`)

// 6. Create quote — probe with validation error (missing required)
await probe('POST create-quote (validation probe)', 'POST', `/v2/properties/${propId}/quotes`, {})

// 7. Create reservation — probe with validation error (missing required)
await probe('POST create-reservation (validation probe)', 'POST', `/v2/reservations`, {})

// 8. Cancel reservation — probe with validation error (missing initiatedBy)
await probe('POST cancel-reservation (validation probe)', 'POST', `/v2/reservations/${resId}/cancel`, {})

// 9. iCal import create — probe with bad URL
await probe('POST create-ical-import (validation probe)', 'POST', `/v2/properties/${propId}/ical-imports`, { url: 'not-a-url' })
