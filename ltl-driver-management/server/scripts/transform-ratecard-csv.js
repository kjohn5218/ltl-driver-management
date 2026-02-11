#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Complete column mapping from CSV headers to database columns
const COLUMN_MAPPING = {
  'Driver Id': 'entityId',
  'Driver Name': '_driverName',        // Store in notes
  'Employer': '_employer',             // Store in notes
  'Linehaul Name': '_linehaulName',    // Store in notes (would need ID lookup)
  'Dispatch Orig': '_dispatchOrig',    // Store in notes (would need ID lookup)
  'Dest': '_dest',                     // Store in notes (would need ID lookup)
  'Prioritize': 'priority',
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

// Fields that should be numeric (decimal)
const NUMERIC_FIELDS = [
  'perTrip', 'perCutTrip', 'cutMiles', 'perSingleMile', 'perDoubleMile',
  'perTripleMile', 'perWorkHour', 'perStopHour', 'perSingleDH', 'perDoubleDH',
  'perTripleDH', 'perChainUp', 'fuelSurcharge', 'rateAmount'
];

// Fields that should be boolean
const BOOLEAN_FIELDS = ['priority', 'autoArrive', 'active'];

// Fields that go into notes
const NOTES_FIELDS = ['_driverName', '_employer', '_linehaulName', '_dispatchOrig', '_dest'];

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

// Clean and transform a value
function transformValue(value, columnName) {
  if (value === undefined || value === null) {
    return '';
  }

  // Remove surrounding quotes
  value = value.replace(/^["']|["']$/g, '').trim();

  // Handle empty values
  if (value === '' || value.toLowerCase() === 'null') {
    return '';
  }

  // Transform based on field type
  if (BOOLEAN_FIELDS.includes(columnName)) {
    const upper = value.toUpperCase();
    if (upper === 'TRUE' || upper === '1' || upper === 'YES') {
      return 'true';
    }
    return 'false';
  }

  if (NUMERIC_FIELDS.includes(columnName)) {
    // Remove currency symbols and formatting
    const cleaned = value.replace(/[$,]/g, '');
    // Check if it's actually a number
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      return { value: '', original: value }; // Return original for notes
    }
    return cleaned;
  }

  if (columnName === 'entityId') {
    const num = parseInt(value, 10);
    return isNaN(num) ? '' : num.toString();
  }

  return value;
}

// Main transformation function
function transformCSV(inputPath, outputPath) {
  console.log(`Reading from: ${inputPath}`);

  const content = fs.readFileSync(inputPath, 'utf-8');
  // Handle all line ending styles: \r\n (Windows), \n (Unix), \r (old Mac)
  const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim());

  if (lines.length === 0) {
    console.error('Error: CSV file is empty');
    process.exit(1);
  }

  // Parse header row
  const oldHeaders = parseCSVLine(lines[0]);
  console.log(`Found ${oldHeaders.length} columns in source CSV`);
  console.log('Original headers:', oldHeaders.join(', '));

  // Define the output columns (database columns)
  const outputColumns = [
    'rateType',
    'entityId',
    'originTerminalId',
    'destinationTerminalId',
    'linehaulProfileId',
    'rateMethod',
    'rateAmount',
    'effectiveDate',
    'expirationDate',
    'equipmentType',
    'priority',
    'externalRateId',
    'notes',
    'active',
    'createdAt',
    'updatedAt',
    'autoArrive',
    'perTrip',
    'perCutTrip',
    'cutMiles',
    'cutMilesType',
    'perSingleMile',
    'perDoubleMile',
    'perTripleMile',
    'perWorkHour',
    'perStopHour',
    'perSingleDH',
    'perDoubleDH',
    'perTripleDH',
    'perChainUp',
    'fuelSurcharge'
  ];

  // Build mapping from old column index to new column name
  const columnIndexMap = {};
  oldHeaders.forEach((header, index) => {
    // Try exact match first
    let newColumn = COLUMN_MAPPING[header];

    // Try case-insensitive match
    if (!newColumn) {
      const lowerHeader = header.toLowerCase();
      for (const [key, val] of Object.entries(COLUMN_MAPPING)) {
        if (key.toLowerCase() === lowerHeader) {
          newColumn = val;
          break;
        }
      }
    }

    if (newColumn) {
      columnIndexMap[index] = newColumn;
    } else {
      console.log(`  Warning: Unmapped column "${header}" at index ${index}`);
    }
  });

  // Handle duplicate "Per Triple Mile" column (likely should be Per Triple D/H)
  const tripleIndices = [];
  oldHeaders.forEach((header, index) => {
    if (header.toLowerCase().includes('triple')) {
      tripleIndices.push({ index, header });
    }
  });
  if (tripleIndices.length > 1) {
    // Second "Per Triple Mile" is likely "Per Triple D/H"
    const secondTriple = tripleIndices[1];
    if (columnIndexMap[secondTriple.index] === 'perTripleMile') {
      columnIndexMap[secondTriple.index] = 'perTripleDH';
      console.log(`  Note: Treating second "${secondTriple.header}" as perTripleDH`);
    }
  }

  // Transform data rows
  const outputRows = [outputColumns.join(',')];
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const outputRow = {};
    const noteParts = [];

    // Initialize with empty values
    outputColumns.forEach(col => {
      outputRow[col] = '';
    });

    // Set required defaults
    const now = new Date().toISOString();
    outputRow['rateMethod'] = 'PER_MILE';
    outputRow['effectiveDate'] = now;
    outputRow['createdAt'] = now;
    outputRow['updatedAt'] = now;
    outputRow['active'] = 'true';
    outputRow['priority'] = 'false';

    // Map old values to new columns
    Object.entries(columnIndexMap).forEach(([oldIndex, newColumn]) => {
      const rawValue = values[parseInt(oldIndex)];

      if (rawValue === undefined || rawValue === '') {
        return;
      }

      // Handle notes fields
      if (NOTES_FIELDS.includes(newColumn)) {
        const cleanValue = rawValue.replace(/^["']|["']$/g, '').trim();
        if (cleanValue) {
          const fieldLabel = newColumn.replace(/^_/, '');
          noteParts.push(`${fieldLabel}: ${cleanValue}`);
        }
        return;
      }

      const transformed = transformValue(rawValue, newColumn);

      // Handle case where numeric field had non-numeric value
      if (typeof transformed === 'object' && transformed.original) {
        const headerName = oldHeaders[parseInt(oldIndex)];
        noteParts.push(`${headerName}: ${transformed.original}`);
        outputRow[newColumn] = transformed.value;
      } else {
        outputRow[newColumn] = transformed;
      }
    });

    // Determine rateType based on data
    if (outputRow['entityId']) {
      outputRow['rateType'] = 'DRIVER';
    } else {
      // No driver ID - check if we have employer in notes
      const hasEmployer = noteParts.some(n => n.startsWith('employer:'));
      outputRow['rateType'] = hasEmployer ? 'CARRIER' : 'DEFAULT';
    }

    // Set rateAmount from the first available rate field
    if (!outputRow['rateAmount']) {
      const ratePriority = ['perTrip', 'perCutTrip', 'perSingleMile', 'perWorkHour', 'perStopHour'];
      for (const field of ratePriority) {
        if (outputRow[field]) {
          outputRow['rateAmount'] = outputRow[field];
          break;
        }
      }
      // Default to 0 if no rate found
      if (!outputRow['rateAmount']) {
        outputRow['rateAmount'] = '0.00';
      }
    }

    // Build notes field
    if (noteParts.length > 0) {
      // Escape quotes and wrap in quotes
      const notesContent = noteParts.join('; ').replace(/"/g, '""');
      outputRow['notes'] = `"${notesContent}"`;
    }

    // Build output line
    const outputLine = outputColumns.map(col => {
      const val = outputRow[col];
      // Quote values that contain commas (but notes is already quoted)
      if (val && val.includes(',') && !val.startsWith('"')) {
        return `"${val}"`;
      }
      return val;
    }).join(',');

    outputRows.push(outputLine);
  }

  // Write output
  fs.writeFileSync(outputPath, outputRows.join('\n'), 'utf-8');
  console.log(`\nTransformed ${outputRows.length - 1} rows`);
  if (skippedRows > 0) {
    console.log(`Skipped ${skippedRows} empty rows`);
  }
  console.log(`Output written to: ${outputPath}`);
  console.log('\nOutput columns:', outputColumns.join(', '));
}

// CLI handling
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Rate Card CSV Transformer
=========================

Usage: node transform-ratecard-csv.js <input.csv> [output.csv]

This script transforms a rate card CSV with display headers
to use the correct database column names.

Example:
  node transform-ratecard-csv.js "Pay Rules.csv" ratecards-import.csv
`);
  process.exit(0);
}

const inputFile = path.resolve(args[0]);
const outputFile = args[1]
  ? path.resolve(args[1])
  : inputFile.replace(/\.csv$/i, '-transformed.csv');

if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file not found: ${inputFile}`);
  process.exit(1);
}

transformCSV(inputFile, outputFile);
