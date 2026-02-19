import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

interface LocationRow {
  Code: string;
  Name: string;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  Latitude: number | string;
  Longitude: number | string;
  'Active Physical Terminal': string | boolean;
  'Active Virtual Terminal': string | boolean;
  'Active Dispatch Location': string | boolean;
  'Time Zone': string;
}

function parseBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toUpperCase() === 'TRUE';
  }
  return false;
}

function parseDecimal(value: number | string | undefined): number | null {
  if (value === undefined || value === '' || value === null) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

async function importLocations() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: npx ts-node scripts/importLocations.ts <path-to-excel-file>');
    process.exit(1);
  }

  console.log(`Reading Excel file: ${filePath}`);

  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: LocationRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${rows.length} locations to import`);

  // Track stats
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const code = String(row.Code).trim().toUpperCase();

    if (!code) {
      console.warn('Skipping row with empty code');
      errors++;
      continue;
    }

    try {
      const data = {
        name: row.Name?.trim() || null,
        address: row.Address?.trim() || null,
        city: row.City?.trim() || null,
        state: row.State?.trim() || null,
        zipCode: row.Zip?.toString().trim() || null,
        latitude: parseDecimal(row.Latitude),
        longitude: parseDecimal(row.Longitude),
        isPhysicalTerminal: parseBoolean(row['Active Physical Terminal']),
        isVirtualTerminal: parseBoolean(row['Active Virtual Terminal']),
        isDispatchLocation: parseBoolean(row['Active Dispatch Location']),
        timeZone: row['Time Zone']?.trim() || null,
        active: true
      };

      // Check if location exists
      const existing = await prisma.location.findUnique({
        where: { code }
      });

      if (existing) {
        // Update existing location
        await prisma.location.update({
          where: { code },
          data
        });
        updated++;
      } else {
        // Create new location
        await prisma.location.create({
          data: {
            code,
            ...data
          }
        });
        created++;
      }
    } catch (error: any) {
      console.error(`Error processing location ${code}:`, error.message);
      errors++;
    }
  }

  console.log('\n--- Import Summary ---');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${created + updated + errors}`);

  await prisma.$disconnect();
}

importLocations().catch((error) => {
  console.error('Import failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
