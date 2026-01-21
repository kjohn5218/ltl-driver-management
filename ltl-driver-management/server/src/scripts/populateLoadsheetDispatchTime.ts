/**
 * Populate existing loadsheets with targetDispatchTime from linehaul profile's standardDepartureTime
 * Run with: npx ts-node src/scripts/populateLoadsheetDispatchTime.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateLoadsheetDispatchTime() {
  console.log('Populating loadsheets with targetDispatchTime from linehaul profiles...');

  // Get all loadsheets that don't have targetDispatchTime set
  const loadsheets = await prisma.loadsheet.findMany({
    where: {
      targetDispatchTime: null
    }
  });

  console.log(`Found ${loadsheets.length} loadsheets without targetDispatchTime`);

  // Get all linehaul profiles with their standard departure times
  const profiles = await prisma.linehaulProfile.findMany({
    select: {
      id: true,
      name: true,
      profileCode: true,
      standardDepartureTime: true
    }
  });

  // Create a map for quick lookup by profile name/code
  const profileMap = new Map<string, string | null>();
  for (const profile of profiles) {
    if (profile.standardDepartureTime) {
      // Map by both name and profileCode for flexibility
      if (profile.name) profileMap.set(profile.name.toUpperCase(), profile.standardDepartureTime);
      if (profile.profileCode) profileMap.set(profile.profileCode.toUpperCase(), profile.standardDepartureTime);
    }
  }

  let updatedCount = 0;

  for (const loadsheet of loadsheets) {
    // Try to find matching profile by linehaulName
    const linehaulName = loadsheet.linehaulName?.toUpperCase();
    let targetDispatchTime = linehaulName ? profileMap.get(linehaulName) : null;

    // If no exact match, try to match by prefix (e.g., "ABQELP2" matches "ABQELP")
    if (!targetDispatchTime && linehaulName) {
      for (const [key, value] of profileMap.entries()) {
        if (linehaulName.startsWith(key) || key.startsWith(linehaulName)) {
          targetDispatchTime = value;
          break;
        }
      }
    }

    if (targetDispatchTime) {
      await prisma.loadsheet.update({
        where: { id: loadsheet.id },
        data: { targetDispatchTime }
      });
      updatedCount++;
      console.log(`Updated loadsheet ${loadsheet.manifestNumber}: targetDispatchTime = ${targetDispatchTime}`);
    }
  }

  console.log(`\nUpdated ${updatedCount} loadsheets with targetDispatchTime`);
  console.log('Done!');
}

populateLoadsheetDispatchTime()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
