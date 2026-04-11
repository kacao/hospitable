const token = process.env['HOSPITABLE_API_PAT']
if (!token) throw new Error('HOSPITABLE_API_PAT missing')
const BASE = 'https://public.api.hospitable.com'
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

const propsRes = await fetch(`${BASE}/v2/properties`, { headers })
const { data: props } = (await propsRes.json()) as { data: Array<{ id: string }> }
const propId = props[0]!.id

async function call(label: string, path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { headers })
  let body = await res.text()
  try {
    const j = JSON.parse(body)
    body = JSON.stringify(j).slice(0, 400)
  } catch { /* */ }
  console.log(`── ${label} ──  HTTP ${res.status}`)
  console.log(`  ${body}\n`)
}

// Test each candidate include on reservations individually — the API silently
// ignores unknown includes rather than erroring, so we test by seeing whether
// the field shows up in the response.
async function testReservationInclude(include: string): Promise<void> {
  const res = await fetch(
    `${BASE}/v2/reservations?properties[]=${propId}&include=${include}&per_page=1`,
    { headers },
  )
  const j = (await res.json()) as { data: Array<Record<string, unknown>> }
  const first = j.data[0] ?? {}
  const keys = Object.keys(first).sort().join(',')
  const has = include in first
  console.log(`include=${include.padEnd(20)} present=${has}  keys: ${keys}`)
}

console.log('=== Reservation include probe ===')
for (const c of ['guest', 'user', 'financials', 'listings', 'properties', 'review', 'smart_devices', 'smart_locks', 'tasks', 'transactions', 'payouts', 'messages', 'conversation']) {
  await testReservationInclude(c)
}

console.log('\n=== Missing endpoints availability ===')
await call('get user and billing', '/v2/user')
await call('transactions list', '/v2/transactions')
await call('payouts list', '/v2/payouts')
await call('search properties', '/v2/properties/search?q=ana')
await call('property images', `/v2/properties/${propId}/images`)
await call('enrichable shortcodes', '/v2/shortcodes')

console.log('\n=== Reservations list: lastMessageAt filter ===')
await call(
  'lastMessageAt filter',
  `/v2/reservations?properties[]=${propId}&last_message_at=2026-01-01T00:00:00Z&per_page=1`,
)
