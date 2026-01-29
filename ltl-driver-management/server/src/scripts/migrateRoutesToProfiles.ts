/**
 * Migration script to populate linehaul_profiles from routes table
 *
 * Run with: npx ts-node src/scripts/migrateRoutesToProfiles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateRoutesToProfiles() {
  console.log('Starting migration of Routes to LinehaulProfiles...\n');

  try {
    // Get all active routes
    const routes = await prisma.route.findMany({
      where: { active: true }
    });

    console.log(`Found ${routes.length} active routes to migrate\n`);

    if (routes.length === 0) {
      console.log('No routes to migrate.');
      return;
    }

    // Get all terminals
    const terminals = await prisma.terminal.findMany();
    console.log(`Found ${terminals.length} terminals in database\n`);

    // Create a map for quick terminal lookup by name, code, or city
    const findTerminal = (name: string, city?: string | null, _state?: string | null) => {
      const searchName = name.toLowerCase().trim();

      // Try exact code match first
      let terminal = terminals.find(t => t.code?.toLowerCase() === searchName);
      if (terminal) return terminal;

      // Try name match
      terminal = terminals.find(t => t.name?.toLowerCase() === searchName);
      if (terminal) return terminal;

      // Try city match
      if (city) {
        terminal = terminals.find(t => t.city?.toLowerCase() === city.toLowerCase());
        if (terminal) return terminal;
      }

      // Try partial match on name or city
      terminal = terminals.find(t =>
        t.name?.toLowerCase().includes(searchName) ||
        t.city?.toLowerCase().includes(searchName) ||
        searchName.includes(t.code?.toLowerCase() || '') ||
        searchName.includes(t.city?.toLowerCase() || '')
      );

      return terminal;
    };

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const route of routes) {
      try {
        // Check if profile already exists with this name
        const existingProfile = await prisma.linehaulProfile.findFirst({
          where: {
            OR: [
              { name: route.name },
              { profileCode: route.name }
            ]
          }
        });

        if (existingProfile) {
          console.log(`  SKIP: Profile already exists for "${route.name}"`);
          skipped++;
          continue;
        }

        // Find origin terminal
        const originTerminal = findTerminal(route.origin, route.originCity, route.originState);
        if (!originTerminal) {
          console.log(`  FAIL: Could not find origin terminal for "${route.origin}" (route: ${route.name})`);
          failed++;
          continue;
        }

        // Find destination terminal
        const destTerminal = findTerminal(route.destination, route.destinationCity, route.destinationState);
        if (!destTerminal) {
          console.log(`  FAIL: Could not find destination terminal for "${route.destination}" (route: ${route.name})`);
          failed++;
          continue;
        }

        // Create profile code from terminal codes (e.g., "ATL-MEM")
        const profileCode = `${originTerminal.code}-${destTerminal.code}`;

        // Check if profile code already exists
        const existingCode = await prisma.linehaulProfile.findUnique({
          where: { profileCode }
        });

        if (existingCode) {
          console.log(`  SKIP: Profile code "${profileCode}" already exists`);
          skipped++;
          continue;
        }

        // Create the linehaul profile
        await prisma.linehaulProfile.create({
          data: {
            profileCode,
            name: route.name,
            originTerminalId: originTerminal.id,
            destinationTerminalId: destTerminal.id,
            standardDepartureTime: route.departureTime,
            standardArrivalTime: route.arrivalTime,
            distanceMiles: route.distance ? Math.round(Number(route.distance)) : null,
            transitTimeMinutes: route.runTime,
            frequency: route.frequency,
            active: route.active
          }
        });

        console.log(`  OK: Created profile "${profileCode}" (${route.name}) - ${originTerminal.code} -> ${destTerminal.code}`);
        created++;

      } catch (error) {
        console.error(`  ERROR: Failed to migrate route "${route.name}":`, error);
        failed++;
      }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${routes.length}`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateRoutesToProfiles()
  .then(() => {
    console.log('\nMigration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
