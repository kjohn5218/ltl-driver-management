import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

interface ExcelRow {
  Name: string;
  Orig: string;
  'okay to dispatch': string;
}

interface ProfileInfo {
  id: number;
  profileCode: string;
  originCode?: string;
  destCode?: string;
}

function parseDispatchDestinations(destinations: string): string[] {
  if (!destinations) return [];
  // Split by tilde and filter out empty strings
  return destinations.split('~').filter(d => d.trim().length > 0);
}

function extractSegments(code: string): string[] {
  // Extract 3-character alphanumeric segments
  return code.match(/[A-Z0-9]{3}/g) || [];
}

function extractNumSuffix(code: string): string {
  const match = code.match(/(\d+)$/);
  return match ? match[1] : '';
}

async function main() {
  const excelPath = process.argv[2] || '/Users/kevinjohn/Downloads/lh profiles 2.16.26 ok to dispatch.xlsx';

  console.log(`Reading Excel file: ${excelPath}`);

  // Read Excel file
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${data.length} rows in Excel`);

  // Get all profiles from database with origin/dest info
  const profiles = await prisma.linehaulProfile.findMany({
    select: {
      id: true,
      profileCode: true,
      name: true,
      originTerminal: { select: { code: true } },
      destinationTerminal: { select: { code: true } }
    }
  });

  // Create multiple lookups for flexible matching
  const profileByName = new Map<string, ProfileInfo>();
  const profileByNormalized = new Map<string, ProfileInfo>();
  const profilesByOriginDest = new Map<string, ProfileInfo[]>();

  for (const p of profiles) {
    const info: ProfileInfo = {
      id: p.id,
      profileCode: p.profileCode,
      originCode: p.originTerminal?.code?.toUpperCase(),
      destCode: p.destinationTerminal?.code?.toUpperCase()
    };

    // Name lookup
    profileByName.set(p.name.toUpperCase(), info);

    // Normalized lookup (remove hyphens)
    const normalized = p.profileCode.replace(/-/g, '').toUpperCase();
    profileByNormalized.set(normalized, info);

    // Origin-Dest lookup
    if (info.originCode && info.destCode) {
      const key = `${info.originCode}-${info.destCode}`;
      if (!profilesByOriginDest.has(key)) {
        profilesByOriginDest.set(key, []);
      }
      profilesByOriginDest.get(key)!.push(info);
    }
  }

  console.log(`Found ${profiles.length} profiles in database`);

  // Get all locations from database
  const locations = await prisma.location.findMany({
    select: { id: true, code: true }
  });
  const locationMap = new Map(locations.map(l => [l.code.toUpperCase(), l.id]));
  console.log(`Found ${locations.length} locations in database`);

  // Get all terminals from database (for backwards compatibility)
  const terminals = await prisma.terminal.findMany({
    select: { id: true, code: true }
  });
  const terminalMap = new Map(terminals.map(t => [t.code.toUpperCase(), t.id]));
  console.log(`Found ${terminals.length} terminals in database`);

  // Function to find matching profile
  function findMatchingProfile(excelName: string, excelOrig: string): ProfileInfo | null {
    const nameUpper = excelName.toUpperCase();
    const origUpper = excelOrig?.toUpperCase() || '';
    const numSuffix = extractNumSuffix(nameUpper);

    // 1. Try direct name match
    if (profileByName.has(nameUpper)) {
      return profileByName.get(nameUpper)!;
    }

    // 2. Try direct normalized match
    const normalized = nameUpper.replace(/[^A-Z0-9]/g, '');
    if (profileByNormalized.has(normalized)) {
      return profileByNormalized.get(normalized)!;
    }

    // 3. Extract segments and try to match using Orig column
    const segments = extractSegments(nameUpper);

    // 4. If Orig is in segments, find the next segment for the route
    if (origUpper && segments.includes(origUpper)) {
      const origIdx = segments.indexOf(origUpper);
      if (origIdx < segments.length - 1) {
        const nextSeg = segments[origIdx + 1];
        const routeKey = `${origUpper}-${nextSeg}`;
        const candidates = profilesByOriginDest.get(routeKey);

        if (candidates) {
          // Prefer profile with matching number suffix
          const withSuffix = candidates.find(c => c.profileCode.endsWith(numSuffix));
          if (withSuffix) return withSuffix;
          return candidates[0];
        }
      }
    }

    // 5. If Orig is NOT in segments, try Orig -> first segment route
    if (origUpper && segments.length > 0 && !segments.includes(origUpper)) {
      const routeKey = `${origUpper}-${segments[0]}`;
      const candidates = profilesByOriginDest.get(routeKey);
      if (candidates) {
        const withSuffix = candidates.find(c => c.profileCode.endsWith(numSuffix));
        if (withSuffix) return withSuffix;
        return candidates[0];
      }

      // Also try Orig -> MSP for special MSP codes
      if (nameUpper.includes('MSP')) {
        const mspKey = `${origUpper}-MSP`;
        const mspCandidates = profilesByOriginDest.get(mspKey);
        if (mspCandidates) {
          const withSuffix = mspCandidates.find(c => c.profileCode.endsWith(numSuffix));
          if (withSuffix) return withSuffix;
          return mspCandidates[0];
        }
      }
    }

    // 6. Fallback: try first two segments
    if (segments.length >= 2) {
      const routeKey = `${segments[0]}-${segments[1]}`;
      const candidates = profilesByOriginDest.get(routeKey);
      if (candidates) {
        const withSuffix = candidates.find(c => c.profileCode.endsWith(numSuffix));
        if (withSuffix) return withSuffix;
        return candidates[0];
      }
    }

    return null;
  }

  // Track stats
  const stats = {
    matched: 0,
    unmatchedProfiles: [] as string[],
    unmatchedLocations: new Set<string>(),
    totalRecordsCreated: 0,
    skippedDuplicates: 0
  };

  // Process each row
  const recordsToCreate: { linehaulProfileId: number; terminalId: number; locationId: number | null }[] = [];

  for (const row of data) {
    const profile = findMatchingProfile(row.Name, row.Orig);

    if (!profile) {
      const key = `${row.Name}|${row.Orig}`;
      if (!stats.unmatchedProfiles.includes(key)) {
        stats.unmatchedProfiles.push(key);
      }
      continue;
    }

    stats.matched++;

    // Parse dispatch destinations
    const destinations = parseDispatchDestinations(row['okay to dispatch']);

    for (const destCode of destinations) {
      const upperDestCode = destCode.toUpperCase();
      const locationId = locationMap.get(upperDestCode) || null;
      const terminalId = terminalMap.get(upperDestCode);

      if (!terminalId) {
        stats.unmatchedLocations.add(destCode);
        continue;
      }

      recordsToCreate.push({
        linehaulProfileId: profile.id,
        terminalId: terminalId,
        locationId: locationId
      });
    }
  }

  console.log(`\nPrepared ${recordsToCreate.length} records to insert`);

  // Clear existing data
  const deleted = await prisma.profileOkayToDispatch.deleteMany({});
  console.log(`Cleared ${deleted.count} existing records`);

  // Insert in batches to handle duplicates
  const uniqueRecords = new Map<string, typeof recordsToCreate[0]>();
  for (const record of recordsToCreate) {
    const key = `${record.linehaulProfileId}-${record.terminalId}`;
    if (!uniqueRecords.has(key)) {
      uniqueRecords.set(key, record);
    } else {
      stats.skippedDuplicates++;
    }
  }

  const recordsArray = Array.from(uniqueRecords.values());
  console.log(`Inserting ${recordsArray.length} unique records (${stats.skippedDuplicates} duplicates removed)`);

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < recordsArray.length; i += batchSize) {
    const batch = recordsArray.slice(i, i + batchSize);
    await prisma.profileOkayToDispatch.createMany({
      data: batch,
      skipDuplicates: true
    });
    stats.totalRecordsCreated += batch.length;
    process.stdout.write(`\rInserted ${Math.min(i + batchSize, recordsArray.length)}/${recordsArray.length}`);
  }

  console.log('\n\n=== Import Summary ===');
  console.log(`Profiles matched: ${stats.matched}/${data.length} rows`);
  console.log(`Records created: ${stats.totalRecordsCreated}`);
  console.log(`Duplicates skipped: ${stats.skippedDuplicates}`);
  console.log(`\nUnmatched profiles (${stats.unmatchedProfiles.length}):`);
  stats.unmatchedProfiles.slice(0, 20).forEach(p => console.log(`  ${p}`));
  if (stats.unmatchedProfiles.length > 20) {
    console.log(`  ... and ${stats.unmatchedProfiles.length - 20} more`);
  }

  console.log(`\nUnmatched location codes (${stats.unmatchedLocations.size}):`);
  Array.from(stats.unmatchedLocations).slice(0, 20).forEach(l => console.log(`  ${l}`));
  if (stats.unmatchedLocations.size > 20) {
    console.log(`  ... and ${stats.unmatchedLocations.size - 20} more`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
