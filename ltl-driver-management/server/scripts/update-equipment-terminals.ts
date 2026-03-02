/**
 * Script to update equipment terminals from CSV export
 * Run with: npx ts-node scripts/update-equipment-terminals.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CSV data from assets-export-2026-03-02-3.csv
const equipmentData: { unitNumber: string; location: string }[] = [
  { unitNumber: '21927', location: 'Fargo' },
  { unitNumber: '21929', location: 'Minneapolis' },
  { unitNumber: '21930', location: 'Rapid City' },
  { unitNumber: '21931', location: 'Dickinson' },
  { unitNumber: '21932', location: 'Duluth' },
  { unitNumber: '22060', location: 'Bismarck' },
  { unitNumber: '22101', location: 'Duluth' },
  { unitNumber: '22061', location: 'Grand Forks' },
  { unitNumber: '22102', location: 'Fargo' },
  { unitNumber: '22103', location: 'Fargo' },
  { unitNumber: '21476', location: 'Grand Forks' },
  { unitNumber: '160001', location: 'Minneapolis' },
  { unitNumber: '170001', location: 'Bismarck' },
  { unitNumber: '170079', location: 'Billings' },
  { unitNumber: '4153', location: 'Denver' },
  { unitNumber: '160331', location: 'Missoula' },
  { unitNumber: '170175', location: 'Albuquerque' },
  { unitNumber: '188300', location: 'Minneapolis' },
  { unitNumber: '170275', location: 'Dallas' },
  { unitNumber: '170330', location: 'Bozeman' },
  { unitNumber: 'A4280', location: 'Phoenix' },
  { unitNumber: 'A4264', location: 'Bismarck' },
  { unitNumber: 'A4261', location: 'New Castle' },
  { unitNumber: 'A4262', location: 'New Castle' },
  { unitNumber: 'A4263', location: 'Phoenix' },
  { unitNumber: 'A4265', location: 'Casper' },
  { unitNumber: 'A4266', location: 'Reno' },
  { unitNumber: 'A4267', location: 'Las Vegas' },
  { unitNumber: 'A4268', location: 'Minot' },
  { unitNumber: 'A4269', location: 'St. George' },
  { unitNumber: 'A4271', location: 'Tucson' },
  { unitNumber: 'A4272', location: 'Salt Lake City' },
  { unitNumber: 'A4273', location: 'Burley' },
  { unitNumber: 'A4274', location: 'Phoenix' },
  { unitNumber: 'A4276', location: 'Phoenix' },
  { unitNumber: 'A4278', location: 'Boise' },
  { unitNumber: 'A4279', location: 'Salt Lake City' },
  { unitNumber: '223830', location: 'Minneapolis' },
  { unitNumber: '223831', location: 'Des Moines' },
  { unitNumber: '222486', location: 'Watertown' },
  { unitNumber: '222476', location: 'Sioux Falls' },
  { unitNumber: '222490', location: 'Pierre' },
  { unitNumber: '222775', location: 'Idaho Falls' },
  { unitNumber: '223832', location: 'Springfield' },
  { unitNumber: '223833', location: 'Denver' },
  { unitNumber: '223834', location: 'Denver' },
  { unitNumber: '223828', location: 'Omaha' },
  { unitNumber: '223829', location: 'Sioux Falls' },
  { unitNumber: '223835', location: 'Kansas City' },
  { unitNumber: '223836', location: 'Minneapolis' },
  { unitNumber: '150004', location: 'St. Louis' },
  { unitNumber: '140013', location: 'Minneapolis' },
  { unitNumber: '140017', location: 'Omaha' },
  { unitNumber: '140018', location: 'Minneapolis' },
  { unitNumber: '140019', location: 'Kansas City' },
  { unitNumber: '222771', location: 'Albuquerque' },
];

async function main() {
  console.log('Starting equipment terminal update...\n');

  // Get all locations and build a map by city name
  const locations = await prisma.location.findMany({
    select: { id: true, code: true, city: true, name: true }
  });

  // Build lookup map by city (case-insensitive)
  const locationByCity = new Map<string, { id: number; code: string }>();
  for (const loc of locations) {
    if (loc.city) {
      locationByCity.set(loc.city.toLowerCase(), { id: loc.id, code: loc.code });
    }
    // Also try name field
    if (loc.name) {
      locationByCity.set(loc.name.toLowerCase(), { id: loc.id, code: loc.code });
    }
  }

  console.log(`Loaded ${locations.length} locations\n`);

  let trucksUpdated = 0;
  let trailersUpdated = 0;
  let dolliesUpdated = 0;
  let notFound = 0;
  let locationNotFound: string[] = [];

  for (const item of equipmentData) {
    const locationKey = item.location.toLowerCase();
    const location = locationByCity.get(locationKey);

    if (!location) {
      if (!locationNotFound.includes(item.location)) {
        locationNotFound.push(item.location);
      }
      continue;
    }

    // Try to update truck (update both currentLocationId and currentTerminalId)
    const truckResult = await prisma.equipmentTruck.updateMany({
      where: { unitNumber: item.unitNumber },
      data: {
        currentLocationId: location.id,
        currentTerminalId: location.id
      }
    });

    if (truckResult.count > 0) {
      trucksUpdated += truckResult.count;
      console.log(`Updated truck ${item.unitNumber} -> ${item.location} (${location.code})`);
      continue;
    }

    // Try to update trailer
    const trailerResult = await prisma.equipmentTrailer.updateMany({
      where: { unitNumber: item.unitNumber },
      data: {
        currentLocationId: location.id,
        currentTerminalId: location.id
      }
    });

    if (trailerResult.count > 0) {
      trailersUpdated += trailerResult.count;
      console.log(`Updated trailer ${item.unitNumber} -> ${item.location} (${location.code})`);
      continue;
    }

    // Try to update dolly
    const dollyResult = await prisma.equipmentDolly.updateMany({
      where: { unitNumber: item.unitNumber },
      data: {
        currentLocationId: location.id,
        currentTerminalId: location.id
      }
    });

    if (dollyResult.count > 0) {
      dolliesUpdated += dollyResult.count;
      console.log(`Updated dolly ${item.unitNumber} -> ${item.location} (${location.code})`);
      continue;
    }

    notFound++;
    console.log(`Equipment not found: ${item.unitNumber}`);
  }

  console.log('\n========== Summary ==========');
  console.log(`Trucks updated: ${trucksUpdated}`);
  console.log(`Trailers updated: ${trailersUpdated}`);
  console.log(`Dollies updated: ${dolliesUpdated}`);
  console.log(`Equipment not found: ${notFound}`);

  if (locationNotFound.length > 0) {
    console.log(`\nLocations not found in database: ${locationNotFound.join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
