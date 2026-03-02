/**
 * Script to update equipment terminals from CSV export
 * Run with: npx ts-node scripts/update-equipment-terminals.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CSV data from assets-export-2026-03-02 2.csv
const equipmentData: { unitNumber: string; location: string }[] = [
  { unitNumber: '110003', location: 'Denver' },
  { unitNumber: '110004', location: 'Scottsbluff' },
  { unitNumber: '110005', location: 'New Castle' },
  { unitNumber: '110006', location: 'Denver' },
  { unitNumber: '110007', location: 'Denver' },
  { unitNumber: '110008', location: 'Denver' },
  { unitNumber: '110009', location: 'Kansas City' },
  { unitNumber: '110010', location: 'St. Louis' },
  { unitNumber: '110012', location: 'Wichita' },
  { unitNumber: '110013', location: 'Houston' },
  { unitNumber: '110014', location: 'Denver' },
  { unitNumber: '11921', location: 'Fargo' },
  { unitNumber: '11923', location: 'Dickinson' },
  { unitNumber: '11926', location: 'Grand Forks' },
  { unitNumber: '11941', location: 'Kansas City' },
  { unitNumber: '11942', location: 'North Platte' },
  { unitNumber: '11945', location: 'Minneapolis' },
  { unitNumber: '11946', location: 'Denver' },
  { unitNumber: '11948', location: 'Kansas City' },
  { unitNumber: '11949', location: 'Minneapolis' },
  { unitNumber: '12007', location: 'Sioux Falls' },
  { unitNumber: '12010', location: 'Dickinson' },
  { unitNumber: '12011', location: 'Watertown' },
  { unitNumber: '12012', location: 'Minneapolis' },
  { unitNumber: '12013', location: 'Grand Forks' },
  { unitNumber: '12014', location: 'Denver' },
  { unitNumber: '12015', location: 'Omaha' },
  { unitNumber: '12016', location: 'Omaha' },
  { unitNumber: '12062', location: 'Minneapolis' },
  { unitNumber: '12104', location: 'Fargo' },
  { unitNumber: '12105', location: 'Sioux Falls' },
  { unitNumber: '12106', location: 'Omaha' },
  { unitNumber: '12107', location: 'Grand Island' },
  { unitNumber: '12108', location: 'Kansas City' },
  { unitNumber: '130000', location: 'Watertown' },
  { unitNumber: '130001', location: 'Casper' },
  { unitNumber: '130002', location: 'Butte' },
  { unitNumber: '130003', location: 'Missoula' },
  { unitNumber: '130004', location: 'Bozeman' },
  { unitNumber: '130005', location: 'Minot' },
  { unitNumber: '130006', location: 'Fargo' },
  { unitNumber: '130007', location: 'Omaha' },
  { unitNumber: '130008', location: 'Minneapolis' },
  { unitNumber: '130009', location: 'Des Moines' },
  { unitNumber: '130010', location: 'Minneapolis' },
  { unitNumber: '130011', location: 'Minneapolis' },
  { unitNumber: '130012', location: 'Minneapolis' },
  { unitNumber: '130013', location: 'Des Moines' },
  { unitNumber: '130014', location: 'Minneapolis' },
  { unitNumber: '130015', location: 'Omaha' },
  { unitNumber: '130016', location: 'Omaha' },
  { unitNumber: '130017', location: 'Kansas City' },
  { unitNumber: '130018', location: 'Kansas City' },
  { unitNumber: '130019', location: 'Salina' },
  { unitNumber: '130020', location: 'Garden City' },
  { unitNumber: '130021', location: 'Phoenix' },
  { unitNumber: '130022', location: 'Rapid City' },
  { unitNumber: '130023', location: 'Las Vegas' },
  { unitNumber: '130024', location: 'Dallas' },
  { unitNumber: '130025', location: 'Dallas' },
  { unitNumber: '130026', location: 'Grand Island' },
  { unitNumber: '130027', location: 'Grand Island' },
  { unitNumber: '130028', location: 'Omaha' },
  { unitNumber: '130029', location: 'New Castle' },
  { unitNumber: '130032', location: 'Springfield' },
  { unitNumber: '130033', location: 'Wichita' },
  { unitNumber: '130040', location: 'Kansas City' },
  { unitNumber: '130041', location: 'Kansas City' },
  { unitNumber: '130046', location: 'Springfield' },
  { unitNumber: '130047', location: 'St. Louis' },
  { unitNumber: '130048', location: 'St. Louis' },
  { unitNumber: '130050', location: 'Denver' },
  { unitNumber: '130051', location: 'Pueblo' },
  { unitNumber: '130052', location: 'New Castle' },
  { unitNumber: '130053', location: 'Denver' },
  { unitNumber: '130054', location: 'Grand Junction' },
  { unitNumber: '130055', location: 'Grand Junction' },
  { unitNumber: '130056', location: 'Albuquerque' },
  { unitNumber: '130057', location: 'Dallas' },
  { unitNumber: '130058', location: 'Kansas City' },
  { unitNumber: '130059', location: 'Dallas' },
  { unitNumber: '130060', location: 'Dallas' },
  { unitNumber: '130061', location: 'Wichita' },
  { unitNumber: '130062', location: 'Garden City' },
  { unitNumber: '130063', location: 'Houston' },
  { unitNumber: '130064', location: 'Wichita' },
  { unitNumber: '130065', location: 'Bismarck' },
  { unitNumber: '130066', location: 'Rapid City' },
  { unitNumber: '130067', location: 'Sioux Falls' },
  { unitNumber: '130068', location: 'Billings' },
  { unitNumber: '130069', location: 'Butte' },
  { unitNumber: '130070', location: 'Missoula' },
  { unitNumber: '130071', location: 'Minot' },
  { unitNumber: '130072', location: 'Fargo' },
  { unitNumber: '130073', location: 'Great Falls' },
  { unitNumber: '130074', location: 'Rapid City' },
  { unitNumber: '130075', location: 'Salt Lake City' },
  { unitNumber: '130076', location: 'Denver' },
  { unitNumber: '130077', location: 'Salt Lake City' },
  { unitNumber: '130078', location: 'Wichita' },
  { unitNumber: '130079', location: 'Salt Lake City' },
  { unitNumber: '130080', location: 'Minneapolis' },
  { unitNumber: '130081', location: 'Salt Lake City' },
  { unitNumber: '130082', location: 'Reno' },
  { unitNumber: '130083', location: 'Grand Island' },
  { unitNumber: '130084', location: 'Salt Lake City' },
  { unitNumber: '130085', location: 'Salt Lake City' },
  { unitNumber: '130086', location: 'Salt Lake City' },
  { unitNumber: '130087', location: 'Las Vegas' },
  { unitNumber: '130089', location: 'Phoenix' },
  { unitNumber: '130090', location: 'Phoenix' },
  { unitNumber: '130091', location: 'Denver' },
  { unitNumber: '130092', location: 'Denver' },
  { unitNumber: '130093', location: 'Denver' },
  { unitNumber: '130094', location: 'Denver' },
  { unitNumber: '130095', location: 'Kansas City' },
  { unitNumber: '130096', location: 'Salina' },
  { unitNumber: '130097', location: 'Salina' },
  { unitNumber: '130098', location: 'Wichita' },
  { unitNumber: '130099', location: 'Albuquerque' },
  { unitNumber: '130100', location: 'Salt Lake City' },
  { unitNumber: '130101', location: 'Scottsbluff' },
  { unitNumber: '130102', location: 'Reno' },
  { unitNumber: '130103', location: 'Dallas' },
  { unitNumber: '130104', location: 'Houston' },
  { unitNumber: '130105', location: 'Kansas City' },
  { unitNumber: '130106', location: 'Roswell' },
  { unitNumber: '130107', location: 'Roswell' },
  { unitNumber: '130108', location: 'Reno' },
  { unitNumber: '130109', location: 'Scottsbluff' },
  { unitNumber: '130110', location: 'Fargo' },
  { unitNumber: '130111', location: 'Bismarck' },
  { unitNumber: '130112', location: 'Bismarck' },
  { unitNumber: '130113', location: 'Dickinson' },
  { unitNumber: '130114', location: 'Butte' },
  { unitNumber: '130115', location: 'Rapid City' },
  { unitNumber: '130116', location: 'Missoula' },
  { unitNumber: '130117', location: 'Bismarck' },
  { unitNumber: '130119', location: 'Billings' },
  { unitNumber: '130120', location: 'Wichita' },
  { unitNumber: '130121', location: 'Salina' },
  { unitNumber: '130122', location: 'Wichita' },
  { unitNumber: '130123', location: 'Wichita' },
  { unitNumber: '130124', location: 'Wichita' },
  { unitNumber: '130125', location: 'Hays' },
  { unitNumber: '130126', location: 'Wichita' },
  { unitNumber: '130127', location: 'Wichita' },
  { unitNumber: '130128', location: 'Hays' },
  { unitNumber: '130129', location: 'Dallas' },
  { unitNumber: '130130', location: 'El Paso' },
  { unitNumber: '130131', location: 'Phoenix' },
  { unitNumber: '130132', location: 'Phoenix' },
  { unitNumber: '130133', location: 'Phoenix' },
  { unitNumber: '130134', location: 'Phoenix' },
  { unitNumber: '130135', location: 'Phoenix' },
  { unitNumber: '130136', location: 'Las Vegas' },
  { unitNumber: '130137', location: 'Las Vegas' },
  { unitNumber: '130138', location: 'Phoenix' },
  { unitNumber: '130139', location: 'Tucson' },
  { unitNumber: '130140', location: 'Denver' },
  { unitNumber: '130141', location: 'Durango' },
  { unitNumber: '130142', location: 'Denver' },
  { unitNumber: '130144', location: 'Denver' },
  { unitNumber: '130145', location: 'Denver' },
  { unitNumber: '130146', location: 'Denver' },
  { unitNumber: '130147', location: 'Denver' },
  { unitNumber: '130148', location: 'Denver' },
  { unitNumber: '130149', location: 'Pueblo' },
  { unitNumber: '130150', location: 'Salt Lake City' },
  { unitNumber: '130151', location: 'Salt Lake City' },
  { unitNumber: '130152', location: 'Salt Lake City' },
  { unitNumber: '130153', location: 'Salt Lake City' },
  { unitNumber: '130154', location: 'Salt Lake City' },
  { unitNumber: '130155', location: 'St. George' },
  { unitNumber: '130156', location: 'Grand Junction' },
  { unitNumber: '130157', location: 'Reno' },
  { unitNumber: '130158', location: 'Reno' },
  { unitNumber: '130159', location: 'Reno' },
  { unitNumber: '130160', location: 'St. Louis' },
  { unitNumber: '130161', location: 'St. Louis' },
  { unitNumber: '130162', location: 'Kansas City' },
  { unitNumber: '130163', location: 'Kansas City' },
  { unitNumber: '130164', location: 'Kansas City' },
  { unitNumber: '130165', location: 'Kansas City' },
  { unitNumber: '130167', location: 'Albuquerque' },
  { unitNumber: '130168', location: 'Albuquerque' },
  { unitNumber: '130169', location: 'Dallas' },
  { unitNumber: '130170', location: 'Grand Island' },
  { unitNumber: '130171', location: 'Omaha' },
  { unitNumber: '130172', location: 'Omaha' },
  { unitNumber: '130173', location: 'Las Vegas' },
  { unitNumber: '130174', location: 'Des Moines' },
  { unitNumber: '130175', location: 'Minneapolis' },
  { unitNumber: '130176', location: 'Minneapolis' },
  { unitNumber: '130177', location: 'Sioux Falls' },
  { unitNumber: '130178', location: 'Sioux Falls' },
  { unitNumber: '130179', location: 'Denver' },
  { unitNumber: '160013', location: 'El Paso' },
  { unitNumber: '160025', location: 'El Paso' },
  { unitNumber: '174', location: 'Garden City' },
  { unitNumber: '175', location: 'Wichita' },
  { unitNumber: '176', location: 'Hays' },
  { unitNumber: '177', location: 'Garden City' },
  { unitNumber: '178', location: 'Garden City' },
  { unitNumber: '180', location: 'Wichita' },
  { unitNumber: '181', location: 'Salina' },
  { unitNumber: '182', location: 'Hays' },
  { unitNumber: '183', location: 'Garden City' },
  { unitNumber: '210002', location: 'Grand Forks' },
  { unitNumber: '210003', location: 'Fargo' },
  { unitNumber: '210021', location: 'Kalispell' },
  { unitNumber: '210022', location: 'Butte' },
  { unitNumber: '210023', location: 'Kalispell' },
  { unitNumber: '210024', location: 'Kansas City' },
  { unitNumber: '210989', location: 'Great Falls' },
  { unitNumber: '210990', location: 'Missoula' },
  { unitNumber: '210991', location: 'Billings' },
  { unitNumber: '210992', location: 'Billings' },
  { unitNumber: '210993', location: 'Fargo' },
  { unitNumber: '210994', location: 'Fargo' },
  { unitNumber: '210996', location: 'Minneapolis' },
  { unitNumber: '210997', location: 'North Platte' },
  { unitNumber: '210998', location: 'North Platte' },
  { unitNumber: '210999', location: 'Sioux Falls' },
  { unitNumber: '216000', location: 'Sioux Falls' },
  { unitNumber: '216001', location: 'Grand Island' },
  { unitNumber: '216004', location: 'Minot' },
  { unitNumber: '253', location: 'Wichita' },
  { unitNumber: '254', location: 'Wichita' },
  { unitNumber: '255', location: 'Wichita' },
  { unitNumber: '256', location: 'Wichita' },
  { unitNumber: '257', location: 'Scottsbluff' },
  { unitNumber: '417520', location: 'Minot' },
  { unitNumber: '423010', location: 'Casper' },
  { unitNumber: '423011', location: 'Idaho Falls' },
  { unitNumber: '423012', location: 'Reno' },
  { unitNumber: '423013', location: 'Grand Junction' },
  { unitNumber: '423220', location: 'Minneapolis' },
  { unitNumber: '423221', location: 'Pueblo' },
  { unitNumber: '423222', location: 'Fargo' },
  { unitNumber: '423223', location: 'Pueblo' },
  { unitNumber: '423225', location: 'Houston' },
  { unitNumber: '423226', location: 'Garden City' },
  { unitNumber: '423227', location: 'El Paso' },
  { unitNumber: '423228', location: 'Salt Lake City' },
  { unitNumber: '423229', location: 'Tucson' },
  { unitNumber: '423230', location: 'Duluth' },
  { unitNumber: '423324', location: 'Fargo' },
  { unitNumber: '423327', location: 'Reno' },
  { unitNumber: '423328', location: 'Des Moines' },
  { unitNumber: '423329', location: 'Des Moines' },
  { unitNumber: '423330', location: 'Minneapolis' },
  { unitNumber: '423331', location: 'Omaha' },
  { unitNumber: '423332', location: 'Watertown' },
  { unitNumber: '423333', location: 'Omaha' },
  { unitNumber: '423334', location: 'El Paso' },
  { unitNumber: '423335', location: 'Durango' },
  { unitNumber: '423420', location: 'New Castle' },
  { unitNumber: '423421', location: 'El Paso' },
  { unitNumber: '423422', location: 'Minneapolis' },
  { unitNumber: '423423', location: 'Des Moines' },
  { unitNumber: '423424', location: 'Omaha' },
  { unitNumber: '423425', location: 'Durango' },
  { unitNumber: '423426', location: 'Fargo' },
  { unitNumber: '423427', location: 'Houston' },
  { unitNumber: '423428', location: 'Houston' },
  { unitNumber: '423429', location: 'Dallas' },
  { unitNumber: '423430', location: 'Des Moines' },
  { unitNumber: '423431', location: 'Roswell' },
  { unitNumber: '423501', location: 'Grand Island' },
  { unitNumber: '423505', location: 'Fargo' },
  { unitNumber: '423702', location: 'New Castle' },
  { unitNumber: '423802', location: 'Salt Lake City' },
  { unitNumber: '423822', location: 'Sioux Falls' },
  { unitNumber: '423823', location: 'Sioux Falls' },
  { unitNumber: '423824', location: 'Watertown' },
  { unitNumber: '423827', location: 'St. George' },
  { unitNumber: '423829', location: 'Durango' },
  { unitNumber: '423831', location: 'Great Falls' },
  { unitNumber: '423833', location: 'Fargo' },
  { unitNumber: '423836', location: 'Dallas' },
  { unitNumber: '423872', location: 'Wichita' },
  { unitNumber: '423874', location: 'Dallas' },
  { unitNumber: '423876', location: 'Tucson' },
  { unitNumber: '423879', location: 'Bozeman' },
  { unitNumber: '423911', location: 'El Paso' },
  { unitNumber: '423914', location: 'Omaha' },
  { unitNumber: '423916', location: 'Roswell' },
  { unitNumber: '423917', location: 'Minneapolis' },
  { unitNumber: '423920', location: 'Boise' },
  { unitNumber: '423922', location: 'Boise' },
  { unitNumber: '424677', location: 'Minot' },
  { unitNumber: '424678', location: 'Fargo' },
  { unitNumber: '424679', location: 'Fargo' },
  { unitNumber: '424680', location: 'Minneapolis' },
  { unitNumber: '424681', location: 'Minneapolis' },
  { unitNumber: '426001', location: 'Albuquerque' },
  { unitNumber: '426002', location: 'Albuquerque' },
  { unitNumber: '426003', location: 'Albuquerque' },
  { unitNumber: '426004', location: 'Albuquerque' },
  { unitNumber: '426005', location: 'Billings' },
  { unitNumber: '426006', location: 'Billings' },
  { unitNumber: '426007', location: 'Butte' },
  { unitNumber: '426008', location: 'Rapid City' },
  { unitNumber: '426009', location: 'Denver' },
  { unitNumber: '426010', location: 'Denver' },
  { unitNumber: '426011', location: 'Denver' },
  { unitNumber: '426012', location: 'Denver' },
  { unitNumber: '426013', location: 'Denver' },
  { unitNumber: '426014', location: 'Denver' },
  { unitNumber: '426015', location: 'Denver' },
  { unitNumber: '426016', location: 'Minneapolis' },
  { unitNumber: '426017', location: 'Denver' },
  { unitNumber: '426019', location: 'Denver' },
  { unitNumber: '426020', location: 'Phoenix' },
  { unitNumber: '426022', location: 'Fargo' },
  { unitNumber: '426023', location: 'Bismarck' },
  { unitNumber: '426024', location: 'Hays' },
  { unitNumber: '426025', location: 'Grand Island' },
  { unitNumber: '426026', location: 'Denver' },
  { unitNumber: '426027', location: 'Denver' },
  { unitNumber: '426028', location: 'Denver' },
  { unitNumber: '426029', location: 'Grand Junction' },
  { unitNumber: '426030', location: 'Wichita' },
  { unitNumber: '426031', location: 'Salt Lake City' },
  { unitNumber: '426032', location: 'Salt Lake City' },
  { unitNumber: '426033', location: 'Phoenix' },
  { unitNumber: '426034', location: 'Minot' },
  { unitNumber: '426035', location: 'Missoula' },
  { unitNumber: '426036', location: 'Denver' },
  { unitNumber: '426037', location: 'Denver' },
  { unitNumber: '426038', location: 'Denver' },
  { unitNumber: '426039', location: 'Grand Island' },
  { unitNumber: '426040', location: 'Phoenix' },
  { unitNumber: '426041', location: 'Phoenix' },
  { unitNumber: '426043', location: 'Denver' },
  { unitNumber: '426044', location: 'Denver' },
  { unitNumber: '426045', location: 'Denver' },
  { unitNumber: '426046', location: 'Denver' },
  { unitNumber: '426047', location: 'Salt Lake City' },
  { unitNumber: '426048', location: 'Des Moines' },
  { unitNumber: '426049', location: 'Albuquerque' },
  { unitNumber: '426050', location: 'Albuquerque' },
  { unitNumber: '426052', location: 'Salt Lake City' },
  { unitNumber: '426053', location: 'Salt Lake City' },
  { unitNumber: '426054', location: 'Salt Lake City' },
  { unitNumber: '426055', location: 'Sioux Falls' },
  { unitNumber: '426056', location: 'Wichita' },
  { unitNumber: '426057', location: 'Salt Lake City' },
  { unitNumber: '426058', location: 'Salt Lake City' },
  { unitNumber: '426059', location: 'Phoenix' },
  { unitNumber: '426060', location: 'Sioux Falls' },
  { unitNumber: '426061', location: 'Sioux Falls' },
  { unitNumber: '426062', location: 'Wichita' },
  { unitNumber: '426063', location: 'Wichita' },
  { unitNumber: '426064', location: 'Wichita' },
  { unitNumber: '426065', location: 'Wichita' },
  { unitNumber: '426066', location: 'Salina' },
  { unitNumber: '426067', location: 'Wichita' },
  { unitNumber: '426068', location: 'Wichita' },
  { unitNumber: '426069', location: 'Wichita' },
  { unitNumber: '426070', location: 'Hays' },
  { unitNumber: '5016633', location: 'Kalispell' },
  { unitNumber: '5016640', location: 'Durango' },
  { unitNumber: '5016807', location: 'Durango' },
  { unitNumber: '5194', location: 'Grand Junction' },
  { unitNumber: '5199', location: 'Bozeman' },
  { unitNumber: 'A945', location: 'St. George' },
  { unitNumber: 'A946', location: 'Grand Junction' },
  { unitNumber: 'A947', location: 'Grand Junction' },
  { unitNumber: 'A948', location: 'Phoenix' },
  { unitNumber: 'A949', location: 'Phoenix' },
  { unitNumber: 'A952', location: 'Reno' },
  { unitNumber: 'A954', location: 'Las Vegas' },
  { unitNumber: 'L5412', location: 'LQR' },
  { unitNumber: 'L5413', location: 'LQR' },
  { unitNumber: 'L5414', location: 'LQR' },
  { unitNumber: 'L5415', location: 'LQR' },
  { unitNumber: 'L5416', location: 'LQR' },
  { unitNumber: 'L5417', location: 'LQR' },
  { unitNumber: 'L5418', location: 'LQR' },
  { unitNumber: 'L5419', location: 'LQR' },
  { unitNumber: 'L5420', location: 'LQR' },
  { unitNumber: 'M5404', location: 'Denver' },
  { unitNumber: 'M5425', location: 'LQR' },
];

async function main() {
  console.log('Starting equipment terminal update...\n');

  // Get all locations and build a map by city name
  const locations = await prisma.location.findMany({
    select: { id: true, code: true, city: true, name: true }
  });

  // Build lookup map by city (case-insensitive)
  const locationByCity = new Map<string, { id: number; code: string }>();
  for (const loc of locations) {
    if (loc.city) {
      locationByCity.set(loc.city.toLowerCase(), { id: loc.id, code: loc.code });
    }
    // Also try name field
    if (loc.name) {
      locationByCity.set(loc.name.toLowerCase(), { id: loc.id, code: loc.code });
    }
  }

  console.log(`Loaded ${locations.length} locations\n`);

  let trucksUpdated = 0;
  let trailersUpdated = 0;
  let dolliesUpdated = 0;
  let notFound = 0;
  let locationNotFound: string[] = [];

  for (const item of equipmentData) {
    const locationKey = item.location.toLowerCase();
    const location = locationByCity.get(locationKey);

    if (!location) {
      if (!locationNotFound.includes(item.location)) {
        locationNotFound.push(item.location);
      }
      continue;
    }

    // Try to update truck
    const truckResult = await prisma.equipmentTruck.updateMany({
      where: { unitNumber: item.unitNumber },
      data: { currentLocationId: location.id }
    });

    if (truckResult.count > 0) {
      trucksUpdated += truckResult.count;
      console.log(`Updated truck ${item.unitNumber} -> ${item.location} (${location.code})`);
      continue;
    }

    // Try to update trailer
    const trailerResult = await prisma.equipmentTrailer.updateMany({
      where: { unitNumber: item.unitNumber },
      data: { currentLocationId: location.id }
    });

    if (trailerResult.count > 0) {
      trailersUpdated += trailerResult.count;
      console.log(`Updated trailer ${item.unitNumber} -> ${item.location} (${location.code})`);
      continue;
    }

    // Try to update dolly
    const dollyResult = await prisma.equipmentDolly.updateMany({
      where: { unitNumber: item.unitNumber },
      data: { currentLocationId: location.id }
    });

    if (dollyResult.count > 0) {
      dolliesUpdated += dollyResult.count;
      console.log(`Updated dolly ${item.unitNumber} -> ${item.location} (${location.code})`);
      continue;
    }

    notFound++;
    console.log(`Equipment not found: ${item.unitNumber}`);
  }

  console.log('\n========== Summary ==========');
  console.log(`Trucks updated: ${trucksUpdated}`);
  console.log(`Trailers updated: ${trailersUpdated}`);
  console.log(`Dollies updated: ${dolliesUpdated}`);
  console.log(`Equipment not found: ${notFound}`);

  if (locationNotFound.length > 0) {
    console.log(`\nLocations not found in database: ${locationNotFound.join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
