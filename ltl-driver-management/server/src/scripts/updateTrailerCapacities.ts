/**
 * Update existing trailers with capacity based on length
 * Run with: npx ts-node src/scripts/updateTrailerCapacities.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Capacity mapping based on trailer length (in lbs)
const lengthToCapacity: Record<number, number> = {
  53: 45000,
  48: 44000,
  45: 42000,
  43: 40000,
  40: 40000,
  28: 20000
};

async function updateTrailerCapacities() {
  console.log('Updating trailer capacities based on length...');

  // Get all trailers
  const trailers = await prisma.equipmentTrailer.findMany({
    select: {
      id: true,
      unitNumber: true,
      lengthFeet: true,
      capacityWeight: true
    }
  });

  console.log(`Found ${trailers.length} trailers to update`);

  let updated = 0;
  for (const trailer of trailers) {
    const length = trailer.lengthFeet || 53;
    const newCapacity = lengthToCapacity[length] || 45000;

    // Update if capacity is different or null
    if (trailer.capacityWeight !== newCapacity) {
      await prisma.equipmentTrailer.update({
        where: { id: trailer.id },
        data: { capacityWeight: newCapacity }
      });
      console.log(`Updated ${trailer.unitNumber}: ${length}' -> ${newCapacity.toLocaleString()} lbs (was ${trailer.capacityWeight?.toLocaleString() || 'null'})`);
      updated++;
    }
  }

  console.log(`\nDone! Updated ${updated} trailers.`);
}

updateTrailerCapacities()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
