/**
 * Populate existing loadsheets with pieces and weight data
 * Run with: npx ts-node src/scripts/populateLoadsheetWeights.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateLoadsheetWeights() {
  console.log('Populating loadsheets with pieces and weight data...');

  // Get all loadsheets that don't have pieces/weight set
  const loadsheets = await prisma.loadsheet.findMany({
    where: {
      OR: [
        { pieces: null },
        { weight: null }
      ]
    }
  });

  console.log(`Found ${loadsheets.length} loadsheets to update`);

  for (const loadsheet of loadsheets) {
    // Generate realistic pieces and weight based on trailer size and status
    // Capacity in lbs based on trailer length
    const trailerLength = loadsheet.suggestedTrailerLength || 53;
    const capacityMap: Record<number, number> = { 28: 20000, 40: 40000, 43: 40000, 45: 42000, 48: 44000, 53: 45000 };
    const trailerCapacity = capacityMap[trailerLength] || 45000;

    // Vary the load percentage based on status
    let loadPercentage = 0.5;
    switch (loadsheet.status) {
      case 'DRAFT':
        loadPercentage = 0;
        break;
      case 'OPEN':
        loadPercentage = 0.1 + Math.random() * 0.2;
        break;
      case 'LOADING':
        loadPercentage = 0.3 + Math.random() * 0.4;
        break;
      case 'CLOSED':
      case 'DISPATCHED':
        loadPercentage = 0.75 + Math.random() * 0.2;
        break;
      default:
        loadPercentage = 0.5;
    }

    // currentLoad is now weight in lbs
    const currentLoad = Math.round(trailerCapacity * loadPercentage);
    const weight = Math.round(currentLoad + Math.random() * 2000);
    const pieces = Math.round(currentLoad / 50 + Math.random() * 20); // ~50 lbs per piece average

    await prisma.loadsheet.update({
      where: { id: loadsheet.id },
      data: {
        pieces: pieces > 0 ? pieces : null,
        weight: weight > 0 ? weight : null
      }
    });

    console.log(`Updated loadsheet ${loadsheet.manifestNumber}: ${pieces} pieces, ${weight} lbs`);
  }

  console.log('Done!');
}

populateLoadsheetWeights()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
