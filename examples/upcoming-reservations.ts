import { HospitableClient } from '../src'

const client = new HospitableClient({ token: process.env['HOSPITABLE_API_PAT'] })

const { data: properties } = await client.properties.list()
const propertyIds = properties.map((p) => p.id)

const upcoming = await client.reservations.getUpcoming(propertyIds)
console.log(`Upcoming reservations: ${upcoming.meta.total}`)
for (const r of upcoming.data) {
  // AGENTS.md §Safety forbids logging guest PII. Use the reservation code
  // (opaque to the guest) as the human-visible row identifier instead of
  // `r.guest.firstName`. If you're debugging guest-specific logic, pipe
  // through the SDK's `sanitize()` util rather than unmasking here.
  console.log(`  ${r.arrivalDate} → ${r.departureDate}  code: ${r.code}`)
}
