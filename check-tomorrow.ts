import { HospitableClient } from './src'

async function main() {
  const token = process.env.HOSPITABLE_PAT || process.env.HOSPITABLE_ACCESS_TOKEN;
  if (!token) {
    console.error('No token found');
    process.exit(1);
  }

  const client = new HospitableClient({ token, debug: true });
  
  // "Tomorrow" relative to March 14, 2026 is March 15, 2026
  const tomorrow = '2026-03-15';
  console.log(`Checking for check-ins on: ${tomorrow}`);

  try {
    console.log('Testing connection by listing properties...');
    const properties = await client.properties.list();
    console.log(`Successfully connected. Found ${properties.meta.total} properties.`);

    const propertyIds = properties.data.map(p => p.id);

    const reservations = await client.reservations.list({
      properties: propertyIds,
      startDate: tomorrow,
      endDate: tomorrow,
      status: ['accepted']
    });

    console.log(`Total reservations found: ${reservations.meta.total}`);
    if (reservations.data.length > 0) {
      console.log('Sample reservation data:', JSON.stringify(reservations.data[0], null, 2));
    }
    
    // Filter specifically for check-ins on that date
    const checkIns = reservations.data.filter(r => {
      const checkinDate = (r as any).check_in || (r as any).arrival_date || r.checkinDate;
      return checkinDate && checkinDate.startsWith(tomorrow);
    });
    
    if (checkIns.length === 0) {
      console.log('No check-ins found for tomorrow.');
    } else {
      console.log(`Found ${checkIns.length} check-in(s):`);
      for (const res of checkIns) {
        console.log(`- Reservation ID: ${res.id}`);
        console.log(`  Property ID: ${res.propertyId}`);
        console.log(`  Guest: ${res.guest?.firstName} ${res.guest?.lastName}`);
        console.log(`  Platform: ${res.platform}`);
        console.log('---');
      }
    }
  } catch (error) {
    console.error('Error fetching reservations:', error);
  }
}

main();
