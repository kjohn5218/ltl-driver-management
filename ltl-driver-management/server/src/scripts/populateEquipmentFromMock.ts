/**
 * Script to populate equipment tables from mock fleet data
 *
 * Run with: npx ts-node src/scripts/populateEquipmentFromMock.ts
 */

import { PrismaClient } from '@prisma/client';
import { fleetMockService } from '../services/fleet.mock.service';

const prisma = new PrismaClient();

async function populateEquipment() {
  console.log('Starting equipment population from mock data...\n');

  try {
    // Get mock trucks
    const mockTrucks = await fleetMockService.getTrucks({ limit: 100, page: 1 });
    console.log(`Found ${mockTrucks.trucks.length} mock trucks`);

    // Get mock trailers
    const mockTrailers = await fleetMockService.getTrailers({ limit: 100, page: 1 });
    console.log(`Found ${mockTrailers.trailers.length} mock trailers`);

    // Get mock dollies
    const mockDollies = await fleetMockService.getDollies({ limit: 100, page: 1 });
    console.log(`Found ${mockDollies.dollies.length} mock dollies\n`);

    let trucksCreated = 0;
    let trailersCreated = 0;
    let dolliesCreated = 0;

    // Create trucks
    for (const truck of mockTrucks.trucks) {
      const existing = await prisma.equipmentTruck.findFirst({
        where: { unitNumber: truck.unitNumber }
      });

      if (!existing) {
        await prisma.equipmentTruck.create({
          data: {
            unitNumber: truck.unitNumber,
            truckType: truck.truckType,
            make: truck.make || 'Unknown',
            model: truck.model || 'Unknown',
            year: truck.year || 2020,
            vin: truck.vin || `VIN-${truck.unitNumber}`,
            status: truck.status || 'AVAILABLE',
            licensePlate: truck.licensePlate,
            licensePlateState: truck.licensePlateState,
            fuelType: truck.fuelType,
            owned: truck.owned ?? true
          }
        });
        console.log(`  Created truck: ${truck.unitNumber}`);
        trucksCreated++;
      } else {
        console.log(`  Skipped truck (exists): ${truck.unitNumber}`);
      }
    }

    // Create trailers
    for (const trailer of mockTrailers.trailers) {
      const existing = await prisma.equipmentTrailer.findFirst({
        where: { unitNumber: trailer.unitNumber }
      });

      if (!existing) {
        await prisma.equipmentTrailer.create({
          data: {
            unitNumber: trailer.unitNumber,
            trailerType: trailer.trailerType,
            lengthFeet: trailer.lengthFeet || 53,
            status: trailer.status || 'AVAILABLE',
            licensePlate: trailer.licensePlate,
            licensePlateState: trailer.licensePlateState,
            owned: trailer.owned ?? true
          }
        });
        console.log(`  Created trailer: ${trailer.unitNumber}`);
        trailersCreated++;
      } else {
        console.log(`  Skipped trailer (exists): ${trailer.unitNumber}`);
      }
    }

    // Create dollies
    for (const dolly of mockDollies.dollies) {
      const existing = await prisma.equipmentDolly.findFirst({
        where: { unitNumber: dolly.unitNumber }
      });

      if (!existing) {
        await prisma.equipmentDolly.create({
          data: {
            unitNumber: dolly.unitNumber,
            dollyType: dolly.dollyType || 'CONVERTER',
            status: dolly.status || 'AVAILABLE'
          }
        });
        console.log(`  Created dolly: ${dolly.unitNumber}`);
        dolliesCreated++;
      } else {
        console.log(`  Skipped dolly (exists): ${dolly.unitNumber}`);
      }
    }

    console.log('\n--- Summary ---');
    console.log(`Trucks created: ${trucksCreated}`);
    console.log(`Trailers created: ${trailersCreated}`);
    console.log(`Dollies created: ${dolliesCreated}`);

  } catch (error) {
    console.error('Error populating equipment:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
populateEquipment()
  .then(() => {
    console.log('\nEquipment population complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nEquipment population failed:', error);
    process.exit(1);
  });
