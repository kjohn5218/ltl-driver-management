#!/usr/bin/env node

/**
 * Import Pay Rules from CSV
 *
 * This script:
 * 1. Creates/updates Carrier records for unique employers
 * 2. Creates/updates CarrierDriver records for drivers with numeric IDs
 * 3. Creates RateCard records linked to the correct drivers/carriers
 *
 * Usage: node import-payrules-csv.js <input.csv> [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

// Column mapping from CSV headers to internal names
const COLUMN_MAPPING = {
  'Driver Id': 'driverId',
  'Driver Name': 'driverName',
  'Employer': 'employer',
  'Linehaul Name': 'linehaulName',
  'Dispatch Orig': 'dispatchOrig',
  'Dest': 'dest',
  'Prioritize': 'prioritize',
  'Auto Arrive': 'autoArrive',
  'Per Trip': 'perTrip',
  'Per Cut Trip': 'perCutTrip',
  'Cut Miles': 'cutMiles',
  'Cut Miles Type': 'cutMilesType',
  'Per Single Mile': 'perSingleMile',
  'Per Double Mile': 'perDoubleMile',
  'Per Triple Mile': 'perTripleMile',
  'Per Work Hour': 'perWorkHour',
  'Per Stop Hour': 'perStopHour',
  'Per Single D/H': 'perSingleDH',
  'Per Double D/H': 'perDoubleDH',
  'Per Triple D/H': 'perTripleDH',
  'Per Chain-Up': 'perChainUp',
  'Fuel Surcharge': 'fuelSurcharge',
};

// Parse CSV line handling quoted values
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// Parse currency/decimal value
function parseDecimal(value) {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse boolean value
function parseBoolean(value) {
  if (!value) return false;
  const upper = value.toUpperCase().trim();
  return upper === 'TRUE' || upper === '1' || upper === 'YES';
}

// Parse the CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Handle all line ending styles: \r\n (Windows), \n (Unix), \r (old Mac)
  const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = parseCSVLine(lines[0]);
  console.log('CSV Headers:', headers.join(', '));

  // Build column index map
  const columnMap = {};
  headers.forEach((header, index) => {
    const mapped = COLUMN_MAPPING[header] || COLUMN_MAPPING[header.trim()];
    if (mapped) {
      columnMap[mapped] = index;
    }
  });

  // Handle duplicate "Per Triple Mile" (second one is likely Per Triple D/H)
  let tripleCount = 0;
  headers.forEach((header, index) => {
    if (header.toLowerCase().includes('per triple mile')) {
      tripleCount++;
      if (tripleCount === 2) {
        columnMap['perTripleDH'] = index;
        console.log(`  Note: Treating second "Per Triple Mile" at index ${index} as perTripleDH`);
      }
    }
  });

  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record = {};

    for (const [field, index] of Object.entries(columnMap)) {
      record[field] = values[index]?.replace(/^["']|["']$/g, '').trim() || '';
    }

    // Skip completely empty rows
    const hasData = record.driverId || record.employer || record.perTrip ||
                    record.perCutTrip || record.perSingleMile || record.perWorkHour;
    if (!hasData) {
      continue;
    }

    records.push(record);
  }

  return records;
}

// Main import function
async function importPayRules(filePath, dryRun = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Pay Rules Import ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Reading from: ${filePath}\n`);

  const records = parseCSV(filePath);
  console.log(`Found ${records.length} pay rule records\n`);

  // Separate records by type
  const driverRecords = records.filter(r => r.driverId);
  const carrierRecords = records.filter(r => !r.driverId && r.employer);

  console.log(`  - ${driverRecords.length} driver-specific rate cards`);
  console.log(`  - ${carrierRecords.length} carrier/employer rate cards\n`);

  // =====================================================
  // Step 1: Create carriers for unique employers
  // =====================================================
  console.log('--- Step 1: Processing Carriers ---\n');

  const allEmployers = [...new Set(records.map(r => r.employer).filter(e => e))];
  console.log(`Found ${allEmployers.length} unique employers\n`);

  const carrierMap = {}; // employer name -> carrier id

  for (const employerName of allEmployers) {
    let carrier = await prisma.carrier.findFirst({
      where: {
        OR: [
          { name: employerName },
          { dbaName: employerName },
        ]
      }
    });

    if (carrier) {
      console.log(`  ✓ Carrier exists: "${employerName}" (ID: ${carrier.id})`);
      carrierMap[employerName] = carrier.id;
    } else {
      if (dryRun) {
        console.log(`  + Would create carrier: "${employerName}"`);
        carrierMap[employerName] = -1; // Placeholder
      } else {
        carrier = await prisma.carrier.create({
          data: {
            name: employerName,
            status: 'ACTIVE',
          }
        });
        console.log(`  + Created carrier: "${employerName}" (ID: ${carrier.id})`);
        carrierMap[employerName] = carrier.id;
      }
    }
  }

  // =====================================================
  // Step 2: Create drivers from driver records
  // =====================================================
  console.log('\n--- Step 2: Processing Drivers ---\n');

  const driverMap = {}; // externalDriverId -> database id
  let driversCreated = 0;
  let driversUpdated = 0;

  for (const record of driverRecords) {
    const externalId = record.driverId;

    // Skip if we already processed this driver
    if (driverMap[externalId]) {
      continue;
    }

    // Find carrier for this driver (if employer specified)
    let carrierId = record.employer ? carrierMap[record.employer] : null;

    // If no carrier, use CCFS as the default carrier
    if (!carrierId) {
      let ccfsCarrier = await prisma.carrier.findFirst({
        where: {
          OR: [
            { name: 'CCFS' },
            { name: { contains: 'CCFS', mode: 'insensitive' } }
          ]
        }
      });

      if (!ccfsCarrier && !dryRun) {
        ccfsCarrier = await prisma.carrier.create({
          data: { name: 'CCFS', status: 'ACTIVE' }
        });
        console.log(`  + Created CCFS carrier (ID: ${ccfsCarrier.id})`);
      }

      carrierId = ccfsCarrier?.id || -1;
    }

    // Check if driver already exists
    let driver = await prisma.carrierDriver.findFirst({
      where: { externalDriverId: externalId }
    });

    const driverData = {
      carrierId: carrierId,
      name: record.driverName || `Driver ${externalId}`,
      externalDriverId: externalId,
      number: externalId,
      active: true,
    };

    if (driver) {
      driverMap[externalId] = driver.id;
      if (dryRun) {
        console.log(`  ✓ Driver exists: "${record.driverName}" (External: ${externalId}, DB ID: ${driver.id})`);
      } else {
        await prisma.carrierDriver.update({
          where: { id: driver.id },
          data: driverData,
        });
        console.log(`  ~ Updated driver: "${record.driverName}" (External: ${externalId}, DB ID: ${driver.id})`);
        driversUpdated++;
      }
    } else {
      if (dryRun) {
        console.log(`  + Would create driver: "${record.driverName}" (External: ${externalId})`);
        driverMap[externalId] = -1; // Placeholder
      } else {
        driver = await prisma.carrierDriver.create({
          data: driverData,
        });
        console.log(`  + Created driver: "${record.driverName}" (External: ${externalId}, DB ID: ${driver.id})`);
        driverMap[externalId] = driver.id;
        driversCreated++;
      }
    }
  }

  console.log(`\n  Drivers created: ${driversCreated}, updated: ${driversUpdated}`);

  // =====================================================
  // Step 3: Create rate cards
  // =====================================================
  console.log('\n--- Step 3: Processing Rate Cards ---\n');

  let rateCardsCreated = 0;
  let rateCardsUpdated = 0;
  let rateCardsSkipped = 0;
  let rateCardsErrors = 0;

  for (const record of records) {
    try {
      // Determine rate type and entity ID
      let rateType;
      let entityId = null;

      if (record.driverId) {
        rateType = 'DRIVER';
        entityId = driverMap[record.driverId];
        if (!entityId || entityId === -1) {
          if (!dryRun) {
            console.log(`  ✗ Skipping rate card - driver not found: ${record.driverId}`);
            rateCardsSkipped++;
            continue;
          }
        }
      } else if (record.employer) {
        rateType = 'CARRIER';
        entityId = carrierMap[record.employer];
      } else {
        rateType = 'DEFAULT';
      }

      // Calculate primary rate amount
      const rateAmount = parseDecimal(record.perTrip) ||
                         parseDecimal(record.perCutTrip) ||
                         parseDecimal(record.perSingleMile) ||
                         parseDecimal(record.perWorkHour) ||
                         parseDecimal(record.perStopHour) ||
                         0;

      // Build rate card data
      const rateCardData = {
        rateType: rateType,
        entityId: entityId && entityId !== -1 ? entityId : null,
        rateMethod: 'PER_MILE',
        rateAmount: new Prisma.Decimal(rateAmount),
        effectiveDate: new Date(),
        priority: parseBoolean(record.prioritize),
        active: true,
        autoArrive: parseBoolean(record.autoArrive),
        perTrip: parseDecimal(record.perTrip) ? new Prisma.Decimal(parseDecimal(record.perTrip)) : null,
        perCutTrip: parseDecimal(record.perCutTrip) ? new Prisma.Decimal(parseDecimal(record.perCutTrip)) : null,
        cutMiles: parseDecimal(record.cutMiles) ? new Prisma.Decimal(parseDecimal(record.cutMiles)) : null,
        cutMilesType: record.cutMilesType || null,
        perSingleMile: parseDecimal(record.perSingleMile) ? new Prisma.Decimal(parseDecimal(record.perSingleMile)) : null,
        perDoubleMile: parseDecimal(record.perDoubleMile) ? new Prisma.Decimal(parseDecimal(record.perDoubleMile)) : null,
        perTripleMile: parseDecimal(record.perTripleMile) ? new Prisma.Decimal(parseDecimal(record.perTripleMile)) : null,
        perWorkHour: parseDecimal(record.perWorkHour) ? new Prisma.Decimal(parseDecimal(record.perWorkHour)) : null,
        perStopHour: parseDecimal(record.perStopHour) ? new Prisma.Decimal(parseDecimal(record.perStopHour)) : null,
        perSingleDH: parseDecimal(record.perSingleDH) ? new Prisma.Decimal(parseDecimal(record.perSingleDH)) : null,
        perDoubleDH: parseDecimal(record.perDoubleDH) ? new Prisma.Decimal(parseDecimal(record.perDoubleDH)) : null,
        perTripleDH: parseDecimal(record.perTripleDH) ? new Prisma.Decimal(parseDecimal(record.perTripleDH)) : null,
        perChainUp: parseDecimal(record.perChainUp) ? new Prisma.Decimal(parseDecimal(record.perChainUp)) : null,
        fuelSurcharge: parseDecimal(record.fuelSurcharge) ? new Prisma.Decimal(parseDecimal(record.fuelSurcharge)) : null,
        // Store additional info in notes
        notes: [
          record.driverName ? `Driver: ${record.driverName}` : null,
          record.employer ? `Employer: ${record.employer}` : null,
          record.linehaulName ? `Linehaul: ${record.linehaulName}` : null,
          record.dispatchOrig ? `Origin: ${record.dispatchOrig}` : null,
          record.dest ? `Dest: ${record.dest}` : null,
        ].filter(Boolean).join('; ') || null,
      };

      // Check if rate card already exists for this entity
      let existingRateCard = null;
      if (entityId && entityId !== -1) {
        existingRateCard = await prisma.rateCard.findFirst({
          where: {
            rateType: rateType,
            entityId: entityId,
            active: true,
          }
        });
      }

      if (existingRateCard) {
        if (dryRun) {
          console.log(`  ~ Would update rate card for ${rateType} ${entityId}`);
        } else {
          await prisma.rateCard.update({
            where: { id: existingRateCard.id },
            data: rateCardData,
          });
          console.log(`  ~ Updated rate card ID ${existingRateCard.id} for ${rateType} ${entityId}`);
        }
        rateCardsUpdated++;
      } else {
        if (dryRun) {
          const label = record.driverId ? `Driver ${record.driverId}` : record.employer || 'DEFAULT';
          console.log(`  + Would create rate card for ${rateType}: ${label}`);
        } else {
          const newRateCard = await prisma.rateCard.create({
            data: rateCardData,
          });
          const label = record.driverId ? `Driver ${record.driverId}` : record.employer || 'DEFAULT';
          console.log(`  + Created rate card ID ${newRateCard.id} for ${rateType}: ${label}`);
        }
        rateCardsCreated++;
      }

    } catch (error) {
      console.log(`  ✗ Error creating rate card: ${error.message}`);
      rateCardsErrors++;
    }
  }

  // =====================================================
  // Summary
  // =====================================================
  console.log(`\n${'='.repeat(60)}`);
  console.log('Import Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Carriers processed: ${allEmployers.length}`);
  console.log(`  Drivers created: ${driversCreated}`);
  console.log(`  Drivers updated: ${driversUpdated}`);
  console.log(`  Rate cards created: ${rateCardsCreated}`);
  console.log(`  Rate cards updated: ${rateCardsUpdated}`);
  console.log(`  Rate cards skipped: ${rateCardsSkipped}`);
  console.log(`  Errors: ${rateCardsErrors}`);
  console.log(`${'='.repeat(60)}\n`);

  if (dryRun) {
    console.log('This was a DRY RUN. No changes were made to the database.');
    console.log('Run without --dry-run to actually import the data.\n');
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Pay Rules CSV Importer
======================

Usage: node import-payrules-csv.js <input.csv> [--dry-run]

Options:
  --dry-run    Preview changes without modifying the database

This script imports pay rules/rate cards from a CSV and:
  1. Creates Carrier records for unique employers
  2. Creates CarrierDriver records for drivers with numeric IDs
  3. Creates RateCard records linked to the correct entity

CSV columns supported:
  - Driver Id, Driver Name, Employer
  - Linehaul Name, Dispatch Orig, Dest
  - Prioritize, Auto Arrive
  - Per Trip, Per Cut Trip, Cut Miles, Cut Miles Type
  - Per Single Mile, Per Double Mile, Per Triple Mile
  - Per Work Hour, Per Stop Hour
  - Per Single D/H, Per Double D/H, Per Triple D/H
  - Per Chain-Up, Fuel Surcharge

Example:
  node import-payrules-csv.js "Pay Rules.csv" --dry-run
  node import-payrules-csv.js "Pay Rules.csv"
`);
    process.exit(0);
  }

  const filePath = path.resolve(args[0]);
  const dryRun = args.includes('--dry-run');

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    await importPayRules(filePath, dryRun);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
