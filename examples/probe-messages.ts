// Scan recent reservations for any messages with non-empty
// attachments / reactions to see the real shapes — the SDK currently
// types them as unknown[] because earlier probes only saw empty arrays.

const token = process.env['HOSPITABLE_API_PAT']
if (!token) throw new Error('HOSPITABLE_API_PAT missing')
const BASE = 'https://public.api.hospitable.com'
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

const { data: props } = await (await fetch(`${BASE}/v2/properties?per_page=100`, { headers })).json() as { data: Array<{ id: string }> }
const propIds = props.map(p => p.id)

const { data: reservations } = await (await fetch(
  `${BASE}/v2/reservations?${propIds.map(id => `properties[]=${id}`).join('&')}&per_page=100`,
  { headers },
)).json() as { data: Array<{ id: string }> }

console.log(`Scanning messages across ${reservations.length} reservations…`)

let nonEmptyAttachments = 0
let nonEmptyReactions = 0
let seenSenderLocation = ''
let seenContentTypes = new Set<string>()
let seenSources = new Set<string>()
let seenSenderTypes = new Set<string>()
let seenSenderRoles = new Set<string | null>()
let integrationNonNull: unknown = null

for (const r of reservations.slice(0, 40)) {
  const res = await fetch(`${BASE}/v2/reservations/${r.id}/messages`, { headers })
  if (!res.ok) continue
  const { data: messages } = await res.json() as { data: Array<Record<string, any>> }
  for (const m of messages) {
    if (m['attachments']?.length > 0) {
      nonEmptyAttachments++
      console.log('  ATTACHMENT sample:', JSON.stringify(m['attachments'][0], null, 2))
    }
    if (m['reactions']?.length > 0) {
      nonEmptyReactions++
      console.log('  REACTION sample:', JSON.stringify(m['reactions'][0], null, 2))
    }
    if (m['content_type']) seenContentTypes.add(m['content_type'])
    if (m['source']) seenSources.add(m['source'])
    if (m['sender_type']) seenSenderTypes.add(m['sender_type'])
    seenSenderRoles.add(m['sender_role'] ?? null)
    if (m['sender']?.location && !seenSenderLocation) seenSenderLocation = m['sender'].location
    if (m['integration'] !== null && !integrationNonNull) integrationNonNull = m['integration']
  }
}

console.log(`\n── Summary ──`)
console.log(`non-empty attachments seen: ${nonEmptyAttachments}`)
console.log(`non-empty reactions seen:   ${nonEmptyReactions}`)
console.log(`content_types seen:         ${[...seenContentTypes].join(', ')}`)
console.log(`sources seen:               ${[...seenSources].join(', ')}`)
console.log(`sender_types seen:          ${[...seenSenderTypes].join(', ')}`)
console.log(`sender_roles seen:          ${[...seenSenderRoles].join(', ')}`)
console.log(`sender.location seen:       ${seenSenderLocation || '(always empty)'}`)
console.log(`integration (non-null):     ${integrationNonNull ?? '(always null)'}`)
