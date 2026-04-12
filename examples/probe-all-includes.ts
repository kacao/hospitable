// Exhaustive include probe for inquiries, reservations, reviews.
// The API silently ignores unknown includes and returns 200 — so we
// check whether each include populates a field on the response body.
// A `present=true` means the SDK should support it.

const token = process.env['HOSPITABLE_API_PAT']
if (!token) throw new Error('HOSPITABLE_API_PAT missing')
const BASE = 'https://public.api.hospitable.com'
const h = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: h })
  return res.json()
}

// Grab one property id and one reservation id for scoped probes
const { data: props } = await fetchJson(`${BASE}/v2/properties?per_page=100`)
const propIds = props.map((p: { id: string }) => p.id)
const propIdParams = propIds.map((id: string) => `properties[]=${id}`).join('&')

async function probeReservationInclude(inc: string): Promise<void> {
  const res = await fetch(
    `${BASE}/v2/reservations?${propIdParams}&include=${inc}&per_page=1`,
    { headers: h },
  )
  const j = await res.json()
  const first = j.data?.[0] ?? {}
  const present = inc in first
  let shape = ''
  if (present) {
    const val = first[inc]
    if (Array.isArray(val)) {
      shape = `array(${val.length})${val.length > 0 ? ` keys=${Object.keys(val[0]).sort().join(',')}` : ''}`
    } else if (val && typeof val === 'object') {
      shape = `object keys=${Object.keys(val).sort().join(',')}`
    } else {
      shape = `primitive: ${JSON.stringify(val)?.slice(0, 80)}`
    }
  }
  console.log(`  include=${inc.padEnd(16)} present=${present}  ${shape}`)
}

async function probeInquiryInclude(inc: string): Promise<void> {
  const res = await fetch(
    `${BASE}/v2/inquiries?${propIdParams}&include=${inc}&per_page=1`,
    { headers: h },
  )
  const j = await res.json()
  if (!j.data) {
    console.log(`  include=${inc.padEnd(16)} skipped — ${JSON.stringify(j).slice(0, 100)}`)
    return
  }
  const first = j.data[0] ?? {}
  const present = inc in first
  let shape = ''
  if (present) {
    const val = first[inc]
    if (Array.isArray(val)) {
      shape = `array(${val.length})${val.length > 0 ? ` keys=${Object.keys(val[0]).sort().join(',')}` : ''}`
    } else if (val && typeof val === 'object') {
      shape = `object keys=${Object.keys(val).sort().join(',')}`
    } else {
      shape = `primitive`
    }
  }
  console.log(`  include=${inc.padEnd(16)} present=${present}  ${shape}`)
}

async function probeReviewInclude(propId: string, inc: string): Promise<void> {
  const res = await fetch(
    `${BASE}/v2/properties/${propId}/reviews?include=${inc}&per_page=1`,
    { headers: h },
  )
  const j = await res.json()
  const first = j.data?.[0] ?? {}
  const present = inc in first
  let shape = ''
  if (present) {
    const val = first[inc]
    if (Array.isArray(val)) {
      shape = `array(${val.length})${val.length > 0 ? ` keys=${Object.keys(val[0]).sort().join(',')}` : ''}`
    } else if (val && typeof val === 'object') {
      shape = `object keys=${Object.keys(val).sort().join(',')}`
    } else {
      shape = `primitive`
    }
  }
  console.log(`  include=${inc.padEnd(16)} present=${present}  ${shape}`)
}

// Candidate includes — known valid + the user's claimed additions + common guesses
const reservationCandidates = [
  'guest', 'user', 'financials', 'listings', 'properties', 'review',
  'smartlock_code', 'smartlock', 'smart_lock_code', 'smartLockCode',
  'smart_locks', 'access_codes', 'lockbox', 'task', 'tasks',
]
const inquiryCandidates = [
  'guest', 'user', 'financials', 'listings', 'properties', 'messages',
  'review', 'smartlock_code',
]
const reviewCandidates = [
  'guest', 'reservation', 'reservations', 'property', 'properties',
]

console.log('=== RESERVATIONS ===')
for (const c of reservationCandidates) await probeReservationInclude(c)

console.log('\n=== INQUIRIES ===')
for (const c of inquiryCandidates) await probeInquiryInclude(c)

console.log('\n=== REVIEWS ===')
// Find a property that has reviews
let reviewProp: string | null = null
for (const pid of propIds) {
  const r = await fetchJson(`${BASE}/v2/properties/${pid}/reviews?per_page=1`)
  if (r.data?.length) {
    reviewProp = pid
    break
  }
}
if (reviewProp) {
  console.log(`  (using property ${reviewProp})`)
  for (const c of reviewCandidates) await probeReviewInclude(reviewProp, c)
} else {
  console.log('  no reviews found on any property')
}

// 4. Probe with the full smartlock_code include and print the actual
// shape (if present) so we can model the type correctly.
console.log('\n=== SMARTLOCK_CODE DETAIL ===')
const res = await fetch(
  `${BASE}/v2/reservations?${propIdParams}&include=smartlock_code&per_page=1`,
  { headers: h },
)
const j = await res.json()
const first = j.data?.[0] ?? {}
if ('smartlock_code' in first) {
  console.log(JSON.stringify(first['smartlock_code'], null, 2))
} else {
  console.log('smartlock_code field NOT present on response')
  console.log('response top-level keys:', Object.keys(first).sort().join(','))
}
