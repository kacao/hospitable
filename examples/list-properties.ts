import { HospitableClient } from '../src'

const client = new HospitableClient({ token: process.env['HOSPITABLE_API_PAT'] })

const { data: properties } = await client.properties.list()
console.log(`Found ${properties.length} properties:`)
for (const p of properties) {
  console.log(`  ${p.name} (${p.propertyType}) — ${p.id}`)
}
