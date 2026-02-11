#!/usr/bin/env node

/**
 * Import Carriers from CSV
 *
 * This script creates/updates Carrier records from a CSV file.
 *
 * Usage: node import-carriers-csv.js <input.csv> [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Column mapping from CSV headers to internal names
const COLUMN_MAPPING = {
  'Type': 'type',
  'Employer': 'name',
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

  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record = {};

    for (const [field, index] of Object.entries(columnMap)) {
      record[field] = values[index]?.replace(/^["']|["']$/g, '').trim() || '';
    }

    // Skip empty rows
    if (!record.name) {
      continue;
    }

    records.push(record);
  }

  return records;
}

// Main import function
async function importCarriers(filePath, dryRun = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Carrier Import ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Reading from: ${filePath}\n`);

  const records = parseCSV(filePath);
  console.log(`Found ${records.length} carrier records\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      // Determine status based on inactive flag and type
      const isActive = record.inactive?.toUpperCase() !== 'TRUE';
      const status = isActive ? 'ACTIVE' : 'INACTIVE';

      // Check if carrier already exists
      let carrier = await prisma.carrier.findFirst({
        where: {
          OR: [
            { name: record.name },
            { dbaName: record.name },
          ]
        }
      });

      const carrierData = {
        name: record.name,
        status: status,
        carrierType: record.type || 'Contractor',
      };

      if (carrier) {
        if (dryRun) {
          console.log(`  ~ Would update carrier: "${record.name}" (ID: ${carrier.id})`);
        } else {
          await prisma.carrier.update({
            where: { id: carrier.id },
            data: carrierData,
          });
          console.log(`  ~ Updated carrier: "${record.name}" (ID: ${carrier.id})`);
        }
        updated++;
      } else {
        if (dryRun) {
          console.log(`  + Would create carrier: "${record.name}"`);
        } else {
          carrier = await prisma.carrier.create({
            data: carrierData,
          });
          console.log(`  + Created carrier: "${record.name}" (ID: ${carrier.id})`);
        }
        created++;
      }

    } catch (error) {
      console.log(`  ✗ Error with carrier "${record.name}": ${error.message}`);
      errors++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Import Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Carriers created: ${created}`);
  console.log(`  Carriers updated: ${updated}`);
  console.log(`  Carriers skipped: ${skipped}`);
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
Carrier CSV Importer
====================

Usage: node import-carriers-csv.js <input.csv> [--dry-run]

Options:
  --dry-run    Preview changes without modifying the database

This script imports carriers from a CSV file with these columns:
  - Type      → carrierType (Contractor, Temp, etc.)
  - Employer  → name
  - Inactive  → status (ACTIVE/INACTIVE)

Example:
  node import-carriers-csv.js carriers.csv --dry-run
  node import-carriers-csv.js carriers.csv
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
    await importCarriers(filePath, dryRun);
  } catch (error) {
    console.error('Import failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
