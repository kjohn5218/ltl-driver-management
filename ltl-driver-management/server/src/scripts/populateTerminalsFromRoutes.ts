/**
 * Script to populate terminals table from unique origins/destinations in routes
 *
 * Run with: npx ts-node src/scripts/populateTerminalsFromRoutes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TerminalData {
  code: string;
  name: string;
  city?: string;
  state?: string;
  address?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
}

async function populateTerminalsFromRoutes() {
  console.log('Starting terminal population from Routes...\n');

  try {
    // Get all routes
    const routes = await prisma.route.findMany({
      where: { active: true }
    });

    console.log(`Found ${routes.length} active routes\n`);

    if (routes.length === 0) {
      console.log('No routes found.');
      return;
    }

    // Build a map of unique terminal codes with their data
    const terminalMap = new Map<string, TerminalData>();

    for (const route of routes) {
      // Process origin
      const originCode = route.origin.toUpperCase().trim();
      if (originCode && !terminalMap.has(originCode)) {
        terminalMap.set(originCode, {
          code: originCode,
          name: route.originCity || originCode,
          city: route.originCity || undefined,
          state: route.originState || undefined,
          address: route.originAddress || undefined,
          zipCode: route.originZipCode || undefined
        });
      } else if (originCode && terminalMap.has(originCode)) {
        // Update with more data if available
        const existing = terminalMap.get(originCode)!;
        if (!existing.city && route.originCity) existing.city = route.originCity;
        if (!existing.state && route.originState) existing.state = route.originState;
        if (!existing.address && route.originAddress) existing.address = route.originAddress;
        if (!existing.zipCode && route.originZipCode) existing.zipCode = route.originZipCode;
      }

      // Process destination
      const destCode = route.destination.toUpperCase().trim();
      if (destCode && !terminalMap.has(destCode)) {
        terminalMap.set(destCode, {
          code: destCode,
          name: route.destinationCity || destCode,
          city: route.destinationCity || undefined,
          state: route.destinationState || undefined,
          address: route.destinationAddress || undefined,
          zipCode: route.destinationZipCode || undefined,
          latitude: route.destinationLatitude ? Number(route.destinationLatitude) : undefined,
          longitude: route.destinationLongitude ? Number(route.destinationLongitude) : undefined
        });
      } else if (destCode && terminalMap.has(destCode)) {
        // Update with more data if available
        const existing = terminalMap.get(destCode)!;
        if (!existing.city && route.destinationCity) existing.city = route.destinationCity;
        if (!existing.state && route.destinationState) existing.state = route.destinationState;
        if (!existing.address && route.destinationAddress) existing.address = route.destinationAddress;
        if (!existing.zipCode && route.destinationZipCode) existing.zipCode = route.destinationZipCode;
        if (!existing.latitude && route.destinationLatitude) existing.latitude = Number(route.destinationLatitude);
        if (!existing.longitude && route.destinationLongitude) existing.longitude = Number(route.destinationLongitude);
      }
    }

    console.log(`Found ${terminalMap.size} unique terminal codes\n`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const [code, data] of terminalMap) {
      try {
        // Check if terminal already exists
        const existing = await prisma.terminal.findUnique({
          where: { code }
        });

        if (existing) {
          console.log(`  SKIP: Terminal "${code}" already exists`);
          skipped++;
          continue;
        }

        // Create the terminal
        await prisma.terminal.create({
          data: {
            code: data.code,
            name: data.name,
            city: data.city,
            state: data.state,
            address: data.address,
            zipCode: data.zipCode,
            latitude: data.latitude,
            longitude: data.longitude,
            active: true
          }
        });

        console.log(`  OK: Created terminal "${code}" (${data.name}${data.city ? `, ${data.city}` : ''}${data.state ? `, ${data.state}` : ''})`);
        created++;

      } catch (error) {
        console.error(`  ERROR: Failed to create terminal "${code}":`, error);
        failed++;
      }
    }

    console.log('\n--- Terminal Population Summary ---');
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total unique codes: ${terminalMap.size}`);

  } catch (error) {
    console.error('Terminal population failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
populateTerminalsFromRoutes()
  .then(() => {
    console.log('\nTerminal population complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTerminal population failed:', error);
    process.exit(1);
  });
