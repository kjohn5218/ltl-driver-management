#!/usr/bin/env node

/**
 * Fix Misassigned Contractor Drivers
 *
 * Finds alphanumeric drivers incorrectly assigned to CCFS
 * and attempts to match them to the correct carrier.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMisassignedDrivers() {
  console.log('Finding misassigned drivers...\n');

  const ccfs = await prisma.carrier.findFirst({ where: { name: 'CCFS' }});
  if (!ccfs) {
    console.log('CCFS carrier not found');
    return;
  }

  // Get all drivers under CCFS
  const allCCFSDrivers = await prisma.carrierDriver.findMany({
    where: { carrierId: ccfs.id }
  });

  // Filter to alphanumeric codes (contractors, not Workday employees)
  const misassigned = allCCFSDrivers.filter(d => d.number && /[A-Za-z]/.test(d.number));
  console.log(`Found ${misassigned.length} alphanumeric drivers under CCFS to fix\n`);

  // Get all carriers for matching
  const allCarriers = await prisma.carrier.findMany({
    select: { id: true, name: true, dbaName: true }
  });

  // Create lookup map (lowercase for case-insensitive matching)
  const carrierByName = new Map();
  allCarriers.forEach(c => {
    carrierByName.set(c.name.toLowerCase(), c);
    if (c.dbaName) {
      carrierByName.set(c.dbaName.toLowerCase(), c);
    }
  });

  let fixed = 0;
  let notFound = [];

  for (const driver of misassigned) {
    const code = (driver.number || '').toUpperCase();
    const name = driver.name || '';
    const nameLower = name.toLowerCase();

    let matchedCarrier = null;
    let matchReason = '';

    // Strategy 1: Look for carrier name mentioned in driver name
    for (const carrier of allCarriers) {
      const carrierNameLower = carrier.name.toLowerCase();

      if (nameLower.includes(carrierNameLower)) {
        matchedCarrier = carrier;
        matchReason = 'name contains carrier';
        break;
      }

      // Check first significant word
      const carrierWords = carrierNameLower.split(/\s+/);
      const firstWord = carrierWords[0];
      if (firstWord.length > 3 && nameLower.includes(firstWord)) {
        matchedCarrier = carrier;
        matchReason = 'name contains: ' + firstWord;
        break;
      }
    }

    // Strategy 2: Match common patterns in driver names
    if (!matchedCarrier) {
      const patterns = [
        { regex: /jrs\s*unlimited/i, carrier: 'JRS Unlimited LLC' },
        { regex: /transnational/i, carrier: 'Transnational Cargo' },
        { regex: /elgon/i, carrier: 'Elgon Logistics' },
        { regex: /ozbee/i, carrier: 'Ozbee Logistics' },
        { regex: /way\s*trucking/i, carrier: 'Way Trucking' },
        { regex: /rpr\s*trans/i, carrier: 'RPR Trans LLC' },
        { regex: /zubias/i, carrier: 'Zubias Transportation LLC' },
        { regex: /brooks/i, carrier: 'BROOKS TRANSPORTATION LLC' },
        { regex: /twerkit/i, carrier: 'Twerkit Trucking LLC' },
        { regex: /hutchinson/i, carrier: 'Hutchinson Trucking' },
        { regex: /hutch/i, carrier: 'Hutchinson Trucking' },
      ];

      for (const p of patterns) {
        if (p.regex.test(name)) {
          const carrier = allCarriers.find(c =>
            c.name.toLowerCase() === p.carrier.toLowerCase()
          );
          if (carrier) {
            matchedCarrier = carrier;
            matchReason = 'pattern match: ' + p.carrier;
            break;
          }
        }
      }
    }

    // Strategy 3: Match by driver code prefix to carrier code patterns
    if (!matchedCarrier && code.length >= 2) {
      const codePatterns = {
        'JR': ['JR Transport LLC', 'JRS Unlimited LLC'],
        'HU': ['Hutchinson Trucking', 'Hunds Transport LLC'],
        'DXP': ['DISPATCH USA'],
        'DTR': ['DTM Trucking'],
        'TC': ['TCF LOGISTICS LLC'],
        'ALL': ['All In The Family'],
        'ELG': ['Elgon Logistics'],
        'WAY': ['Way Trucking'],
        'RPR': ['RPR Trans LLC'],
        'OZB': ['Ozbee Logistics'],
        'ZUB': ['Zubias Transportation LLC'],
        'SF': ['Split Mountain Logistics'],
        'TRT': ['TRS Trucking'],
        'FFS': ['FRIENDT TRANSPORT & SERVICES LLC'],
        'CCP': ['CP TRUCKING LLC'],
        'BAT': ['Bartee Transport'],
      };

      for (const [prefix, carrierNames] of Object.entries(codePatterns)) {
        if (code.startsWith(prefix)) {
          for (const carrierName of carrierNames) {
            const carrier = allCarriers.find(c =>
              c.name.toLowerCase() === carrierName.toLowerCase()
            );
            if (carrier) {
              matchedCarrier = carrier;
              matchReason = 'code prefix: ' + prefix;
              break;
            }
          }
          if (matchedCarrier) break;
        }
      }
    }

    // Apply the fix
    if (matchedCarrier && matchedCarrier.id !== ccfs.id) {
      console.log(`✓ ${driver.number}: "${driver.name}" -> ${matchedCarrier.name} (${matchReason})`);

      await prisma.carrierDriver.update({
        where: { id: driver.id },
        data: { carrierId: matchedCarrier.id }
      });
      fixed++;
    } else {
      notFound.push({ code: driver.number, name: driver.name, id: driver.id });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Fixed: ${fixed} drivers`);
  console.log(`Could not match: ${notFound.length} drivers`);

  if (notFound.length > 0) {
    console.log('\nDrivers that could not be automatically matched:');
    notFound.forEach(d => console.log(`  ${d.code}: ${d.name} (ID: ${d.id})`));
  }

  console.log('='.repeat(60));
}

async function main() {
  try {
    await fixMisassignedDrivers();
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
