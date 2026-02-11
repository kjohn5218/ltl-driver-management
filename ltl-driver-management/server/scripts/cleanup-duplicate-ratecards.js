#!/usr/bin/env node

/**
 * Cleanup Duplicate Rate Cards
 *
 * This script finds and removes duplicate DRIVER rate cards, keeping only:
 * 1. The one linked to a Workday-connected driver (has workdayEmployeeId)
 * 2. If no Workday connection, the one with a valid driver number
 *
 * Usage: node cleanup-duplicate-ratecards.js [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper to parse driver name from notes
function parseDriverNameFromNotes(notes) {
  if (!notes) return null;
  const match = notes.match(/(?:Driver|driverName|Driver Name):\s*([^;.]+)/i);
  return match ? match[1].trim() : null;
}

// Normalize name for comparison
function normalizeName(name) {
  return name.toLowerCase().trim();
}

async function cleanupDuplicates(dryRun = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Duplicate Rate Card Cleanup ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all DRIVER type rate cards with their linked driver info
  const rateCards = await prisma.rateCard.findMany({
    where: { rateType: 'DRIVER', active: true },
    include: {
      // We can't directly include driver since it's not a relation,
      // so we'll look them up separately
    }
  });

  console.log(`Found ${rateCards.length} active DRIVER rate cards\n`);

  // Get all drivers that are referenced
  const driverIds = rateCards.filter(rc => rc.entityId).map(rc => rc.entityId);
  const drivers = await prisma.carrierDriver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true, name: true, number: true, workdayEmployeeId: true }
  });
  const driverMap = new Map(drivers.map(d => [d.id, d]));

  // Enrich rate cards with driver info and parsed notes
  const enrichedCards = rateCards.map(rc => {
    const driver = rc.entityId ? driverMap.get(rc.entityId) : null;
    const notesDriverName = parseDriverNameFromNotes(rc.notes);

    return {
      ...rc,
      driver,
      driverName: driver?.name || notesDriverName,
      hasWorkday: !!driver?.workdayEmployeeId,
      hasDriverNumber: !!driver?.number
    };
  });

  // Group by normalized driver name
  const byName = new Map();
  for (const rc of enrichedCards) {
    if (!rc.driverName) continue;
    const key = normalizeName(rc.driverName);
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key).push(rc);
  }

  // Find duplicates and determine which to keep/delete
  let totalDuplicates = 0;
  let toDelete = [];

  for (const [name, cards] of byName) {
    if (cards.length <= 1) continue;

    console.log(`\nDriver: "${cards[0].driverName}" - ${cards.length} rate cards found`);

    // Sort: Workday first, then has driver number, then by ID (oldest first)
    cards.sort((a, b) => {
      if (a.hasWorkday && !b.hasWorkday) return -1;
      if (!a.hasWorkday && b.hasWorkday) return 1;
      if (a.hasDriverNumber && !b.hasDriverNumber) return -1;
      if (!a.hasDriverNumber && b.hasDriverNumber) return 1;
      return a.id - b.id;
    });

    const keep = cards[0];
    const remove = cards.slice(1);

    console.log(`  KEEP: ID ${keep.id} (Workday: ${keep.hasWorkday}, Driver#: ${keep.driver?.number || 'none'})`);

    for (const rc of remove) {
      console.log(`  DELETE: ID ${rc.id} (Workday: ${rc.hasWorkday}, Driver#: ${rc.driver?.number || 'none'})`);
      toDelete.push(rc.id);
    }

    totalDuplicates += remove.length;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Total duplicate rate cards to remove: ${totalDuplicates}`);

  if (toDelete.length > 0) {
    if (dryRun) {
      console.log(`\n  DRY RUN - No changes made`);
      console.log(`  Run without --dry-run to delete these records\n`);
    } else {
      console.log(`\n  Deleting ${toDelete.length} duplicate rate cards...`);

      const result = await prisma.rateCard.deleteMany({
        where: { id: { in: toDelete } }
      });

      console.log(`  Deleted ${result.count} rate cards\n`);
    }
  } else {
    console.log(`\n  No duplicates found!\n`);
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Duplicate Rate Card Cleanup
===========================

Usage: node cleanup-duplicate-ratecards.js [--dry-run]

Options:
  --dry-run    Preview changes without deleting anything

This script finds DRIVER rate cards with the same driver name and removes
duplicates, keeping only the best record (Workday-connected preferred).
`);
    process.exit(0);
  }

  try {
    await cleanupDuplicates(dryRun);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
