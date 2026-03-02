/**
 * Script to update equipment terminals from CSV export
 * Run with: npx ts-node scripts/update-equipment-terminals.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CSV data from assets-export-2026-03-02-4 2.csv (dollies)
const equipmentData: { unitNumber: string; location: string }[] = [
  { unitNumber: '1417', location: 'Salt Lake City' },
  { unitNumber: '1418', location: 'St. George' },
  { unitNumber: '8605', location: 'Las Vegas' },
  { unitNumber: '1601', location: 'Salt Lake City' },
  { unitNumber: '1602', location: 'Salt Lake City' },
  { unitNumber: '1604', location: 'Salt Lake City' },
  { unitNumber: '1605', location: 'Billings' },
  { unitNumber: '1606', location: 'Salt Lake City' },
  { unitNumber: '1607', location: 'Salt Lake City' },
  { unitNumber: '1609', location: 'Salt Lake City' },
  { unitNumber: '1610', location: 'Bismarck' },
  { unitNumber: '1416', location: 'Las Vegas' },
  { unitNumber: '71842', location: 'Las Vegas' },
  { unitNumber: '71843', location: 'Salt Lake City' },
  { unitNumber: '71844', location: 'Denver' },
  { unitNumber: '71846', location: 'Great Falls' },
  { unitNumber: '71847', location: 'Billings' },
  { unitNumber: '71849', location: 'Salt Lake City' },
  { unitNumber: '71850', location: 'Watertown' },
  { unitNumber: '71722', location: 'Great Falls' },
  { unitNumber: 'D154', location: 'Watertown' },
  { unitNumber: '17009', location: 'Fargo' },
  { unitNumber: '17011', location: 'Las Vegas' },
  { unitNumber: '17012', location: 'Great Falls' },
  { unitNumber: '17002', location: 'Kansas City' },
  { unitNumber: '17004', location: 'Kansas City' },
  { unitNumber: '17006', location: 'Fargo' },
  { unitNumber: 'D112', location: 'Las Vegas' },
  { unitNumber: 'D120', location: 'Boise' },
  { unitNumber: 'D124', location: 'Reno' },
  { unitNumber: 'D126', location: 'Rapid City' },
  { unitNumber: 'D127', location: 'Las Vegas' },
  { unitNumber: 'D132', location: 'Billings' },
  { unitNumber: 'D133', location: 'Denver' },
  { unitNumber: 'D137', location: 'Salt Lake City' },
  { unitNumber: 'D138', location: 'Reno' },
  { unitNumber: 'D139', location: 'Denver' },
  { unitNumber: 'D140', location: 'Las Vegas' },
  { unitNumber: 'D143', location: 'Sioux Falls' },
  { unitNumber: 'D144', location: 'Salt Lake City' },
  { unitNumber: 'D148', location: 'Bismarck' },
  { unitNumber: 'D149', location: 'Missoula' },
  { unitNumber: 'D129', location: 'Reno' },
  { unitNumber: 'D57', location: 'Las Vegas' },
  { unitNumber: 'D150', location: 'Salt Lake City' },
  { unitNumber: '17102', location: 'Fargo' },
  { unitNumber: '17603', location: 'Fargo' },
  { unitNumber: '17082', location: 'Bismarck' },
  { unitNumber: '17182', location: 'Salt Lake City' },
  { unitNumber: '17309', location: 'Fargo' },
  { unitNumber: '17366', location: 'Salt Lake City' },
  { unitNumber: '17381', location: 'Billings' },
  { unitNumber: '17398', location: 'Rapid City' },
  { unitNumber: '21002', location: 'Fargo' },
  { unitNumber: '21004', location: 'Fargo' },
  { unitNumber: '21005', location: 'Missoula' },
  { unitNumber: 'A3083', location: 'Denver' },
  { unitNumber: 'A3097', location: 'Sioux Falls' },
  { unitNumber: 'A3098', location: 'Salt Lake City' },
  { unitNumber: 'C118', location: 'Butte' },
  { unitNumber: 'A60126', location: 'Salt Lake City' },
  { unitNumber: 'A60127', location: 'Denver' },
  { unitNumber: 'A60131', location: 'Phoenix' },
  { unitNumber: 'A60135', location: 'Boise' },
  { unitNumber: 'A60138', location: 'Las Vegas' },
  { unitNumber: 'A60143', location: 'Reno' },
  { unitNumber: 'A60144', location: 'Missoula' },
  { unitNumber: 'A60145', location: 'Bozeman' },
  { unitNumber: 'A60141', location: 'Bozeman' },
  { unitNumber: 'C147', location: 'Phoenix' },
  { unitNumber: 'A60150', location: 'Denver' },
  { unitNumber: 'A60151', location: 'Burley' },
  { unitNumber: 'A60152', location: 'Phoenix' },
  { unitNumber: 'A60154', location: 'Billings' },
  { unitNumber: 'A60155', location: 'Phoenix' },
  { unitNumber: 'A60156', location: 'Las Vegas' },
  { unitNumber: 'A60161', location: 'Missoula' },
  { unitNumber: 'A60162', location: 'Casper' },
  { unitNumber: 'A60165', location: 'Denver' },
  { unitNumber: 'A60168', location: 'Kalispell' },
  { unitNumber: 'A60169', location: 'Kalispell' },
  { unitNumber: 'A60170', location: 'Billings' },
  { unitNumber: 'A60172', location: 'Salt Lake City' },
  { unitNumber: 'A60176', location: 'Denver' },
  { unitNumber: 'A60177', location: 'Las Vegas' },
  { unitNumber: 'A60180', location: 'Rapid City' },
  { unitNumber: 'A60181', location: 'Denver' },
  { unitNumber: 'A60185', location: 'Las Vegas' },
  { unitNumber: 'A60186', location: 'Las Vegas' },
  { unitNumber: '501', location: 'Casper' },
  { unitNumber: 'RC976', location: 'Las Vegas' },
  { unitNumber: 'RD987', location: 'Bozeman' },
  { unitNumber: 'RC986', location: 'Reno' },
  { unitNumber: '901', location: 'Salt Lake City' },
  { unitNumber: 'R970', location: 'Reno' },
  { unitNumber: 'R948', location: 'Reno' },
  { unitNumber: 'RD967', location: 'Denver' },
  { unitNumber: 'RD962', location: 'Butte' },
  { unitNumber: 'RD989', location: 'Missoula' },
  { unitNumber: '8172008', location: 'Salt Lake City' },
  { unitNumber: 'RD980', location: 'Idaho Falls' },
  { unitNumber: 'PD505', location: 'Denver' },
  { unitNumber: '71723', location: 'Salt Lake City' },
  { unitNumber: '71721', location: 'Salt Lake City' },
  { unitNumber: 'D141', location: 'Salt Lake City' },
  { unitNumber: 'D136', location: 'Minot' },
  { unitNumber: '17299', location: 'Bismarck' },
  { unitNumber: 'A3095', location: 'Burley' },
  { unitNumber: '3104', location: 'Sioux Falls' },
  { unitNumber: 'A60122', location: 'Salt Lake City' },
  { unitNumber: '721', location: 'Kansas City' },
  { unitNumber: 'RC988', location: 'Reno' },
  { unitNumber: 'A60140', location: 'St. George' },
  { unitNumber: 'D128', location: 'Bismarck' },
  { unitNumber: '17005', location: 'Minot' },
  { unitNumber: 'RD985', location: 'Great Falls' },
];

// Manual location mappings for cities that don't match exactly
const locationOverrides: Record<string, number> = {
  'st. george': 27,  // SGU - Hurricane
};

async function main() {
  console.log('Starting equipment terminal update (dollies)...\n');

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

    // Check for manual override first
    let locationId = locationOverrides[locationKey];
    let locationCode = locationId ? locations.find(l => l.id === locationId)?.code || 'OVERRIDE' : '';

    if (!locationId) {
      const location = locationByCity.get(locationKey);
      if (!location) {
        if (!locationNotFound.includes(item.location)) {
          locationNotFound.push(item.location);
        }
        continue;
      }
      locationId = location.id;
      locationCode = location.code;
    }

    // Try to update dolly first (since this is a dolly export)
    const dollyResult = await prisma.equipmentDolly.updateMany({
      where: { unitNumber: item.unitNumber },
      data: {
        currentLocationId: locationId,
        currentTerminalId: locationId
      }
    });

    if (dollyResult.count > 0) {
      dolliesUpdated += dollyResult.count;
      console.log(`Updated dolly ${item.unitNumber} -> ${item.location} (${locationCode})`);
      continue;
    }

    // Try to update truck
    const truckResult = await prisma.equipmentTruck.updateMany({
      where: { unitNumber: item.unitNumber },
      data: {
        currentLocationId: locationId,
        currentTerminalId: locationId
      }
    });

    if (truckResult.count > 0) {
      trucksUpdated += truckResult.count;
      console.log(`Updated truck ${item.unitNumber} -> ${item.location} (${locationCode})`);
      continue;
    }

    // Try to update trailer
    const trailerResult = await prisma.equipmentTrailer.updateMany({
      where: { unitNumber: item.unitNumber },
      data: {
        currentLocationId: locationId,
        currentTerminalId: locationId
      }
    });

    if (trailerResult.count > 0) {
      trailersUpdated += trailerResult.count;
      console.log(`Updated trailer ${item.unitNumber} -> ${item.location} (${locationCode})`);
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
