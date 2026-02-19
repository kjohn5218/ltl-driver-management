import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

interface LaneRow {
  Orig: string;
  Dest: string;
}

async function importLinehaulLanes() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: npx ts-node scripts/importLinehaulLanes.ts <path-to-excel-file>');
    process.exit(1);
  }

  console.log(`Reading Excel file: ${filePath}`);

  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: LaneRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${rows.length} lanes to import`);

  // Get all locations and create a lookup map by code
  const locations = await prisma.location.findMany({
    select: { id: true, code: true }
  });

  const locationMap = new Map<string, number>();
  for (const loc of locations) {
    locationMap.set(loc.code.toUpperCase(), loc.id);
  }

  console.log(`Found ${locations.length} locations in database`);

  // Track stats
  let created = 0;
  let skipped = 0;
  let errors = 0;
  const missingLocations = new Set<string>();

  // Process lanes in batches
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

    for (const row of batch) {
      const origCode = String(row.Orig).trim().toUpperCase();
      const destCode = String(row.Dest).trim().toUpperCase();

      const originLocationId = locationMap.get(origCode);
      const destinationLocationId = locationMap.get(destCode);

      if (!originLocationId) {
        missingLocations.add(origCode);
        errors++;
        continue;
      }

      if (!destinationLocationId) {
        missingLocations.add(destCode);
        errors++;
        continue;
      }

      // Skip if same origin and destination
      if (originLocationId === destinationLocationId) {
        skipped++;
        continue;
      }

      try {
        // Check if lane already exists
        const existing = await prisma.linehaulLane.findUnique({
          where: {
            originLocationId_destinationLocationId: {
              originLocationId,
              destinationLocationId
            }
          }
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create the lane
        await prisma.linehaulLane.create({
          data: {
            originLocationId,
            destinationLocationId,
            active: true
          }
        });

        created++;
      } catch (error: any) {
        console.error(`Error creating lane ${origCode} -> ${destCode}:`, error.message);
        errors++;
      }
    }

    // Progress update
    console.log(`Progress: ${Math.min(i + batchSize, rows.length)}/${rows.length} processed`);
  }

  console.log('\n--- Import Summary ---');
  console.log(`Created: ${created}`);
  console.log(`Skipped (duplicates/self-lanes): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (missingLocations.size > 0) {
    console.log(`\nMissing location codes (${missingLocations.size}):`);
    console.log(Array.from(missingLocations).sort().join(', '));
  }

  await prisma.$disconnect();
}

importLinehaulLanes().catch((error) => {
  console.error('Import failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
