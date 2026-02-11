#!/usr/bin/env node

/**
 * Clean Up Duplicate Drivers
 *
 * Finds drivers with duplicate numbers (case-insensitive),
 * keeps the one with the lowest ID (oldest record),
 * and deletes the duplicates.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicateDrivers() {
  console.log('Finding duplicate driver numbers...\n');

  // Get all drivers with their related data counts
  const allDrivers = await prisma.carrierDriver.findMany({
    select: {
      id: true,
      number: true,
      name: true,
      carrierId: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      carrier: { select: { name: true } }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`Total drivers: ${allDrivers.length}\n`);

  // Group by uppercase driver number
  const driversByNumber = new Map();
  for (const driver of allDrivers) {
    if (!driver.number) continue;

    const numUpper = driver.number.toUpperCase().trim();
    if (!driversByNumber.has(numUpper)) {
      driversByNumber.set(numUpper, []);
    }
    driversByNumber.get(numUpper).push(driver);
  }

  // Find duplicates
  const duplicateGroups = [];
  for (const [number, drivers] of driversByNumber) {
    if (drivers.length > 1) {
      duplicateGroups.push({ number, drivers });
    }
  }

  console.log(`Found ${duplicateGroups.length} driver numbers with duplicates\n`);

  if (duplicateGroups.length === 0) {
    console.log('No duplicates to clean up!');
    return;
  }

  // Show preview first
  console.log('Preview of duplicates to merge:\n');
  for (const group of duplicateGroups.slice(0, 20)) {
    console.log(`  ${group.number}: ${group.drivers.length} records`);
    for (const d of group.drivers) {
      console.log(`    - ID ${d.id}: "${d.name}" @ ${d.carrier?.name || 'Unknown'} (active: ${d.active})`);
    }
  }

  if (duplicateGroups.length > 20) {
    console.log(`  ... and ${duplicateGroups.length - 20} more groups\n`);
  }

  console.log('\nProceeding with cleanup...\n');

  let totalDeleted = 0;
  let totalKept = 0;

  for (const group of duplicateGroups) {
    // Sort by ID (keep lowest/oldest)
    const sorted = group.drivers.sort((a, b) => a.id - b.id);
    const primary = sorted[0];
    const duplicates = sorted.slice(1);

    // Delete duplicates
    for (const dup of duplicates) {
      try {
        await prisma.carrierDriver.delete({
          where: { id: dup.id }
        });
        totalDeleted++;
      } catch (error) {
        // If delete fails due to relations, try to handle it
        console.log(`  Could not delete driver ID ${dup.id} (${dup.number}): ${error.message}`);
      }
    }

    totalKept++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('Cleanup Summary:');
  console.log(`  Duplicate groups processed: ${duplicateGroups.length}`);
  console.log(`  Drivers kept (primary): ${totalKept}`);
  console.log(`  Drivers deleted: ${totalDeleted}`);
  console.log('='.repeat(60));

  // Final count
  const finalCount = await prisma.carrierDriver.count();
  console.log(`\nFinal driver count: ${finalCount}`);
}

async function main() {
  try {
    await cleanupDuplicateDrivers();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
