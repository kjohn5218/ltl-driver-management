#!/usr/bin/env node

/**
 * Clean Up Duplicate Carrier Names
 *
 * Finds carriers with duplicate names (case-insensitive),
 * reassigns all drivers to the primary carrier (lowest ID),
 * and deletes the duplicates.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicateCarriers() {
  console.log('Finding duplicate carrier names...\n');

  // Get all carriers
  const allCarriers = await prisma.carrier.findMany({
    include: {
      _count: { select: { drivers: true } }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`Total carriers: ${allCarriers.length}\n`);

  // Group by lowercase name
  const carriersByName = new Map();
  for (const carrier of allCarriers) {
    const nameLower = carrier.name.toLowerCase().trim();
    if (!carriersByName.has(nameLower)) {
      carriersByName.set(nameLower, []);
    }
    carriersByName.get(nameLower).push(carrier);
  }

  // Find duplicates
  const duplicateGroups = [];
  for (const [name, carriers] of carriersByName) {
    if (carriers.length > 1) {
      duplicateGroups.push({ name, carriers });
    }
  }

  console.log(`Found ${duplicateGroups.length} carrier names with duplicates\n`);

  if (duplicateGroups.length === 0) {
    console.log('No duplicates to clean up!');
    return;
  }

  let totalMerged = 0;
  let totalDeleted = 0;
  let totalDriversMoved = 0;

  for (const group of duplicateGroups) {
    // Keep the carrier with the lowest ID (oldest)
    const sorted = group.carriers.sort((a, b) => a.id - b.id);
    const primary = sorted[0];
    const duplicates = sorted.slice(1);

    console.log(`\n"${primary.name}" (keeping ID ${primary.id}):`);

    for (const dup of duplicates) {
      const driverCount = dup._count.drivers;

      if (driverCount > 0) {
        // Reassign drivers to primary carrier
        await prisma.carrierDriver.updateMany({
          where: { carrierId: dup.id },
          data: { carrierId: primary.id }
        });
        console.log(`  - Moved ${driverCount} drivers from ID ${dup.id}`);
        totalDriversMoved += driverCount;
      }

      // Delete the duplicate carrier
      try {
        await prisma.carrier.delete({
          where: { id: dup.id }
        });
        console.log(`  - Deleted duplicate ID ${dup.id} ("${dup.name}")`);
        totalDeleted++;
      } catch (error) {
        console.log(`  - Could not delete ID ${dup.id}: ${error.message}`);
      }
    }

    totalMerged++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('Cleanup Summary:');
  console.log(`  Duplicate groups merged: ${totalMerged}`);
  console.log(`  Carriers deleted: ${totalDeleted}`);
  console.log(`  Drivers reassigned: ${totalDriversMoved}`);
  console.log('='.repeat(60));
}

async function main() {
  try {
    await cleanupDuplicateCarriers();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
