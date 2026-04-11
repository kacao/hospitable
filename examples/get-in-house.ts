// Demonstrates client.reservations.getInHouse() — guests currently staying
// in your properties. Uses dateQuery=checkout + client-side arrival filter.

import { HospitableClient } from '../dist/index.js'

const client = new HospitableClient({ token: process.env['HOSPITABLE_API_PAT'] })

const { data: properties } = await client.properties.list()
const propertyIds = properties.map((p) => p.id)

const inHouse = await client.reservations.getInHouse(propertyIds)
console.log(`Guests currently in-house: ${inHouse.length}`)
for (const r of inHouse) {
  const guestName = r.guest
    ? `${r.guest.firstName} ${r.guest.lastName}`
    : 'unknown'
  console.log(
    `  ${guestName.padEnd(30)}  ${r.arrivalDate.slice(0, 10)} → ${r.departureDate.slice(0, 10)}  ${r.code}`,
  )
}
