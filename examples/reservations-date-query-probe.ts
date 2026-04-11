// Probes the live Hospitable API to determine whether
// `/v2/reservations` accepts and honors `date_query` alongside
// `start_date`/`end_date`. Issues several variants and prints totals
// + first/last record so behavioral differences are visible.

const token = process.env['HOSPITABLE_API_PAT']
if (!token) throw new Error('HOSPITABLE_API_PAT missing')

const BASE = 'https://public.api.hospitable.com'

// Pull every property ID so we can pass `properties[]=` (the API requires it).
const propsRes = await fetch(`${BASE}/v2/properties?per_page=100`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
})
const propsJson = (await propsRes.json()) as { data: Array<{ id: string }> }
const propertyIds = propsJson.data.map((p) => p.id)
console.log(`Probing across ${propertyIds.length} properties\n`)

// Pick a 60-day window centered on today so we'll catch reservations
// whose check-in falls inside but check-out falls outside (and vice versa).
const today = new Date()
const start = new Date(today)
start.setDate(start.getDate() - 30)
const end = new Date(today)
end.setDate(end.getDate() + 30)
const startISO = start.toISOString().split('T')[0]!
const endISO = end.toISOString().split('T')[0]!

console.log(`Date window: ${startISO} → ${endISO}\n`)

type Variant = { label: string; extra: Record<string, string> }
const variants: Variant[] = [
  { label: 'baseline (no date_query)', extra: {} },
  { label: 'date_query=checkin', extra: { date_query: 'checkin' } },
  { label: 'date_query=checkout', extra: { date_query: 'checkout' } },
  { label: 'date_query=checkin_or_checkout', extra: { date_query: 'checkin_or_checkout' } },
  { label: 'date_query=bogus_value', extra: { date_query: 'bogus_value' } },
]

async function probe(v: Variant): Promise<void> {
  const params = new URLSearchParams({
    start_date: startISO,
    end_date: endISO,
    per_page: '3',
    ...v.extra,
  })
  for (const id of propertyIds) params.append('properties[]', id)
  const url = `${BASE}/v2/reservations?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  console.log(`── ${v.label} ──`)
  console.log(`HTTP ${res.status}`)
  if (!res.ok) {
    const body = await res.text()
    console.log(`Error body: ${body.slice(0, 300)}\n`)
    return
  }
  const json = (await res.json()) as {
    data: Array<{ check_in: string; check_out: string; code: string }>
    meta?: { total?: number }
  }
  console.log(`Total: ${json.meta?.total ?? '?'}`)
  for (const r of json.data.slice(0, 3)) {
    console.log(`  ${r.code}  in ${r.check_in}  out ${r.check_out}`)
  }
  console.log()
}

for (const v of variants) {
  await probe(v)
}
