import { HospitableClient } from '../src'

const client = new HospitableClient({ token: process.env['HOSPITABLE_PAT'] })

const { data: properties } = await client.properties.list()
const propertyIds = properties.map((p) => p.id)

const upcoming = await client.reservations.getUpcoming(propertyIds)
console.log(`Upcoming reservations: ${upcoming.meta.total}`)
for (const r of upcoming.data) {
  console.log(`  ${r.checkinDate} → ${r.checkoutDate}  guest: ${r.guest?.firstName ?? 'unknown'}`)
}
