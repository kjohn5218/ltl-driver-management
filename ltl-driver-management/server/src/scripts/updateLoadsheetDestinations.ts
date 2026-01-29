/**
 * Script to update existing loadsheets with destination terminal codes from routes
 *
 * Run with: npx ts-node src/scripts/updateLoadsheetDestinations.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateLoadsheetDestinations() {
  console.log('Starting loadsheet destination update...\n');

  try {
    // Get all loadsheets that don't have a destination or routeId
    const loadsheets = await prisma.loadsheet.findMany({
      where: {
        OR: [
          { destinationTerminalCode: null },
          { routeId: null }
        ]
      }
    });

    console.log(`Found ${loadsheets.length} loadsheets to update\n`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const loadsheet of loadsheets) {
      if (!loadsheet.linehaulName || !loadsheet.originTerminalCode) {
        console.log(`  SKIP: Loadsheet ${loadsheet.manifestNumber} missing linehaulName or originTerminalCode`);
        skipped++;
        continue;
      }

      // Find the route
      const route = await prisma.route.findFirst({
        where: {
          name: loadsheet.linehaulName,
          origin: loadsheet.originTerminalCode,
          active: true
        }
      });

      if (!route) {
        console.log(`  NOT FOUND: No route for ${loadsheet.manifestNumber} (${loadsheet.linehaulName}/${loadsheet.originTerminalCode})`);
        notFound++;
        continue;
      }

      // Update the loadsheet
      await prisma.loadsheet.update({
        where: { id: loadsheet.id },
        data: {
          routeId: route.id,
          destinationTerminalCode: route.destination
        }
      });

      console.log(`  OK: ${loadsheet.manifestNumber} -> ${route.origin} to ${route.destination}`);
      updated++;
    }

    console.log('\n--- Summary ---');
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Not found: ${notFound}`);
    console.log(`Total: ${loadsheets.length}`);

  } catch (error) {
    console.error('Error updating loadsheet destinations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateLoadsheetDestinations()
  .then(() => {
    console.log('\nLoadsheet destination update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nLoadsheet destination update failed:', error);
    process.exit(1);
  });
