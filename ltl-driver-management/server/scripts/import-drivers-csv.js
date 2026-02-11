#!/usr/bin/env node

/**
 * Import Drivers from CSV
 *
 * This script:
 * 1. Reads the drivers CSV file
 * 2. Creates/updates Carrier records for unique employers
 * 3. Creates/updates CarrierDriver records linked to carriers
 *
 * Usage: node import-drivers-csv.js <input.csv> [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Column mapping from CSV headers to internal names
const COLUMN_MAPPING = {
  'Terminal': 'terminal',
  'Emp Num': 'driverId',      // Treat as Driver Id
  'Driver Id': 'driverId',    // Also accept "Driver Id" header
  'Name': 'name',
  'Employer': 'employer',
  'Type': 'type',
  'Category': 'category',
  'Inactive': 'inactive',
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

// Extract phone number from name if present
function extractPhoneFromName(name) {
  if (!name) return { name: '', phone: null };

  // Match phone patterns like "505-359-0203" or "(505) 359-0203"
  const phoneMatch = name.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);

  if (phoneMatch) {
    const phone = phoneMatch[1].replace(/[.\s]/g, '-');
    const cleanName = name.replace(phoneMatch[0], '').trim();
    return { name: cleanName, phone };
  }

  return { name: name.trim(), phone: null };
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
    } else {
      console.log(`  Warning: Unmapped column "${header}"`);
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
    if (!record.employer && !record.name && !record.driverId) {
      continue;
    }

    records.push(record);
  }

  return records;
}

// Main import function
async function importDrivers(filePath, dryRun = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Driver Import ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Reading from: ${filePath}\n`);

  const records = parseCSV(filePath);
  console.log(`Found ${records.length} driver records\n`);

  // Step 1: Extract unique employers and create carriers
  console.log('--- Step 1: Processing Carriers ---\n');

  const uniqueEmployers = [...new Set(records.map(r => r.employer).filter(e => e))];
  console.log(`Found ${uniqueEmployers.length} unique employers\n`);

  const carrierMap = {}; // employer name -> carrier id

  for (const employerName of uniqueEmployers) {
    // Check if carrier already exists
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
        carrierMap[employerName] = `NEW_${employerName}`;
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

  // Step 2: Import drivers
  console.log('\n--- Step 2: Processing Drivers ---\n');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    let carrierId = carrierMap[record.employer];

    // If no carrier specified, use CCFS as default
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

      if (ccfsCarrier) {
        carrierId = ccfsCarrier.id;
      } else if (dryRun) {
        console.log(`  + Would assign driver "${record.name}" to CCFS carrier`);
        carrierId = -1; // Placeholder for dry run
      } else {
        console.log(`  ✗ Skipping driver "${record.name}" - no carrier`);
        skipped++;
        continue;
      }
    }

    if (typeof carrierId === 'string' && carrierId.startsWith('NEW_')) {
      // Dry run - can't actually link to carrier
      console.log(`  + Would create driver: "${record.name}" (${record.driverId}) for ${record.employer}`);
      created++;
      continue;
    }

    // Extract phone from name if present
    const { name: cleanName, phone } = extractPhoneFromName(record.name);

    // Determine active status
    const isActive = record.inactive?.toUpperCase() !== 'TRUE';

    // Check if driver already exists (by externalDriverId + carrier)
    let driver = await prisma.carrierDriver.findFirst({
      where: {
        carrierId: carrierId,
        OR: [
          { externalDriverId: record.driverId },
          { number: record.driverId },
        ]
      }
    });

    const driverData = {
      carrierId: carrierId,
      name: cleanName || record.driverId || 'Unknown',
      number: record.driverId || null,
      externalDriverId: record.driverId || null,  // Store as external ID for linking
      phoneNumber: phone,
      active: isActive,
      homeTerminalCode: record.terminal || null,
      currentTerminalCode: record.terminal || null,
      // Type and Category could be stored in notes or a custom field if needed
    };

    try {
      if (driver) {
        if (dryRun) {
          console.log(`  ~ Would update driver: "${cleanName}" (${record.driverId})`);
        } else {
          await prisma.carrierDriver.update({
            where: { id: driver.id },
            data: driverData,
          });
          console.log(`  ~ Updated driver: "${cleanName}" (${record.driverId}) ID: ${driver.id}`);
        }
        updated++;
      } else {
        if (dryRun) {
          console.log(`  + Would create driver: "${cleanName}" (${record.driverId}) for carrier ID ${carrierId}`);
        } else {
          driver = await prisma.carrierDriver.create({
            data: driverData,
          });
          console.log(`  + Created driver: "${cleanName}" (${record.driverId}) ID: ${driver.id}`);
        }
        created++;
      }
    } catch (error) {
      console.log(`  ✗ Error with driver "${record.name}": ${error.message}`);
      errors++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Import Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Carriers: ${uniqueEmployers.length}`);
  console.log(`  Drivers created: ${created}`);
  console.log(`  Drivers updated: ${updated}`);
  console.log(`  Drivers skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
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
Driver CSV Importer
===================

Usage: node import-drivers-csv.js <input.csv> [--dry-run]

Options:
  --dry-run    Preview changes without modifying the database

This script imports drivers from a CSV file with these columns:
  - Terminal           → homeTerminalCode, currentTerminalCode
  - Emp Num/Driver Id  → externalDriverId, number (e.g., "ZT02", "BLK4")
  - Name               → name (phone extracted if present)
  - Employer           → creates/links to Carrier
  - Type               → stored for reference
  - Category           → stored for reference
  - Inactive           → active (inverted)

Example:
  node import-drivers-csv.js drivers.csv --dry-run
  node import-drivers-csv.js drivers.csv
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
    await importDrivers(filePath, dryRun);
  } catch (error) {
    console.error('Import failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
