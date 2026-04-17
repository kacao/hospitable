// Demonstrates the typed `guest` and `reservation` fields populated when
// `include=guest,reservation` is passed to the reviews list endpoint.
//
// Run with:
//   npm run build && node --env-file=/Volumes/genesis/.env.local \
//     --experimental-strip-types examples/reviews-with-includes.ts

import { HospitableClient } from '../dist/index.js'

const client = new HospitableClient({ token: process.env['HOSPITABLE_API_PAT'] })

const { data: properties } = await client.properties.list()
console.log(`Scanning ${properties.length} properties for reviews…`)

for (const property of properties) {
  const list = await client.reviews.list(property.id, {
    include: 'guest,reservation',
    perPage: 1,
  })
  if (list.data.length === 0) continue

  const review = list.data[0]!
  console.log(`\nProperty: ${property.name} (${property.id})`)
  console.log(`Review:   ${review.id}  (${review.platform})`)
  console.log(`Rating:   ${review.public.rating}/5  "${review.public.review.slice(0, 60)}…"`)
  console.log(`Reviewed: ${review.reviewedAt}`)

  if (review.guest) {
    // AGENTS.md §Safety: guest names are PII — log only the non-identifying
    // locale so copy-pasters don't ship this pattern into production.
    console.log(`Guest:    <redacted> (${review.guest.language})`)
  }
  if (review.reservation) {
    console.log(
      `Stay:     ${review.reservation.code}  ${review.reservation.checkIn} → ${review.reservation.checkOut}`,
    )
  }

  if (review.private.feedback) {
    console.log(`Private feedback (host-only): ${review.private.feedback.slice(0, 80)}…`)
  }

  process.exit(0)
}

console.log('No reviews found across any property.')
