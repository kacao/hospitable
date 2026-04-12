// Full field-level audit of the 7 schemas the user referenced in the
// Hospitable Public API docs. Fetches one representative example of
// each and dumps the complete shape so we can diff against the SDK's
// type definitions.
//
// We do this empirically because the docs at developer.hospitable.com
// are Stoplight Elements (JS-rendered), and static HTML fetches return
// skeleton shells. The live API is the authoritative source of truth.

const token = process.env['HOSPITABLE_API_PAT']
if (!token) throw new Error('HOSPITABLE_API_PAT missing')
const BASE = 'https://public.api.hospitable.com'
const h = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: h })
  return res.json()
}

// Walk an object and produce a flat list of "path -> typeof" for every
// leaf field. Arrays are reported as `[]` and objects as `{}`.
function walkShape(obj: unknown, prefix = ''): string[] {
  const lines: string[] = []
  if (obj === null) return [`${prefix}: null`]
  if (typeof obj !== 'object') return [`${prefix}: ${typeof obj}`]
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [`${prefix}: []`]
    // Walk the first element only
    return [
      `${prefix}: [] (${obj.length} items)`,
      ...walkShape(obj[0], `${prefix}[0]`),
    ]
  }
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (val === null) {
      lines.push(`${path}: null`)
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      lines.push(`${path}: {}`)
      lines.push(...walkShape(val, path))
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${path}: []`)
      } else {
        lines.push(`${path}: [] (${val.length})`)
        lines.push(...walkShape(val[0], `${path}[0]`))
      }
    } else {
      lines.push(`${path}: ${typeof val}`)
    }
  }
  return lines
}

function section(title: string): void {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`== ${title}`)
  console.log('='.repeat(70))
}

// Get one property id to scope
const { data: props } = await fetchJson(`${BASE}/v2/properties?per_page=1`)
const propId = props[0].id
const propParams = `properties[]=${propId}`

// === 1. RESERVATION (with all includes) ===
section('RESERVATION — full shape with all valid includes')
const resIncludes = 'guest,user,financials,listings,properties,review,smartlock_code'
const { data: reservations } = await fetchJson(
  `${BASE}/v2/reservations?${propParams}&include=${resIncludes}&per_page=1`,
)
const reservation = reservations[0]
console.log(walkShape(reservation).join('\n'))

// === 2. RESERVATION FINANCIALS (deep dive — never fully audited before) ===
section('RESERVATION FINANCIALS — deep field walk')
const financials = reservation?.financials
if (financials) {
  console.log(walkShape(financials).join('\n'))
} else {
  console.log('(empty — scanning more reservations for a populated financials)')
  // Scan several reservations until we find one with populated financials
  const props2 = await fetchJson(`${BASE}/v2/properties?per_page=50`)
  const allPropIds = props2.data.map((p: { id: string }) => p.id)
  const allProps = allPropIds.map((id: string) => `properties[]=${id}`).join('&')
  const { data: many } = await fetchJson(
    `${BASE}/v2/reservations?${allProps}&include=financials&status[]=accepted&per_page=20`,
  )
  for (const r of many) {
    const f = r.financials
    // Check if any subfield has non-zero data
    const hasData = f && (
      (f.guest?.fees?.length ?? 0) > 0 ||
      (f.host?.host_fees?.length ?? 0) > 0 ||
      (f.guest?.accommodation?.amount ?? 0) > 0
    )
    if (hasData) {
      console.log(`Found populated financials on ${r.code}`)
      console.log(walkShape(f).join('\n'))
      break
    }
  }
}

// === 3. GUEST COUNTS ===
section('GUEST COUNTS — from reservation.guests')
console.log(walkShape(reservation?.guests).join('\n'))

// === 4. GUEST INFO ===
section('GUEST INFO — from reservation.guest (include=guest)')
console.log(walkShape(reservation?.guest).join('\n'))

// === 5. PROPERTY ===
section('PROPERTY — full shape with all 4 includes')
const { data: propsList } = await fetchJson(
  `${BASE}/v2/properties?include=user,listings,details,bookings&per_page=1`,
)
console.log(walkShape(propsList[0]).join('\n'))

// === 6. MESSAGE ===
section('MESSAGE — full shape')
// Find a reservation with messages
const { data: withMsg } = await fetchJson(
  `${BASE}/v2/reservations?${propParams}&per_page=5`,
)
for (const r of withMsg) {
  const msgRes = await fetchJson(`${BASE}/v2/reservations/${r.id}/messages`)
  if (msgRes.data?.length > 0) {
    console.log(`From reservation ${r.code}:`)
    console.log(walkShape(msgRes.data[0]).join('\n'))
    break
  }
}

// === 7. REVIEW ===
section('REVIEW — full shape with all 3 includes')
// Find a property with reviews
const { data: allProps } = await fetchJson(`${BASE}/v2/properties?per_page=50`)
for (const p of allProps) {
  const r = await fetchJson(
    `${BASE}/v2/properties/${p.id}/reviews?include=guest,reservation,property&per_page=1`,
  )
  if (r.data?.length > 0) {
    console.log(`From property ${p.name}:`)
    console.log(walkShape(r.data[0]).join('\n'))
    break
  }
}
