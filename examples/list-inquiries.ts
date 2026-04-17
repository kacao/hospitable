import { HospitableClient, InquiryFilter } from '../src'

const client = new HospitableClient({ token: process.env['HOSPITABLE_API_PAT'] })

const { data: properties } = await client.properties.list()
const propertyIds = properties.map((p) => p.id)

const filter = new InquiryFilter()
  .properties(propertyIds)
  .include('guest', 'properties')
  .perPage(25)

// AGENTS.md §Safety forbids logging guest PII (names, emails). The outbound
// message template still uses the real first name because it's being sent to
// the guest — the log line below masks it so the PII never hits stdout.
let count = 0
for await (const inquiry of client.inquiries.iter(filter.toParams())) {
  count++
  const stay = inquiry.arrivalDate
    ? `${inquiry.arrivalDate} → ${inquiry.departureDate}`
    : 'no dates'
  console.log(`  ${inquiry.platform}  guest:<redacted>  ${stay}  (${inquiry.property?.name ?? 'n/a'})`)

  // Example: auto-reply to inquiries with no arrival date (still negotiating)
  if (!inquiry.arrivalDate) {
    const receipt = await client.messages.sendForInquiry(
      inquiry.id,
      `Hi ${inquiry.guest.firstName}! Let me know which dates you're looking at and I can check availability.`,
    )
    console.log(`    ↳ replied (sent_ref=${receipt.sentReferenceId})`)
  }
}
console.log(`Total inquiries: ${count}`)
