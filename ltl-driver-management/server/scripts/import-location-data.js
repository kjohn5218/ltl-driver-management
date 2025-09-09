const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function importLocationData() {
  try {
    console.log('🚀 Starting location data import...\n');

    // Read Excel file
    const excelPath = '/Users/kevinjohn/Documents/Location addresses.xlsx';
    console.log(`📁 Reading Excel file: ${excelPath}`);
    
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const locationData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Found ${locationData.length} location records\n`);

    // Create a map of location codes to location data
    const locationMap = {};
    locationData.forEach(row => {
      const locationCode = row['Location Name'];
      locationMap[locationCode] = {
        address: row['Address'],
        city: row['City'],
        state: row['State'],
        zipCode: row['Zip'] ? row['Zip'].toString() : null,
        timeZone: row['Time Zone'],
        latitude: row['Latitude'],
        longitude: row['Longitude']
      };
    });

    console.log('📍 Sample location data:');
    Object.keys(locationMap).slice(0, 5).forEach(code => {
      const loc = locationMap[code];
      console.log(`  ${code}: ${loc.city}, ${loc.state} (${loc.timeZone})`);
    });
    console.log('');

    // Get all routes from database
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        origin: true,
        destination: true,
        name: true,
        originAddress: true,
        originCity: true,
        destinationAddress: true,
        destinationCity: true
      }
    });

    console.log(`🗺️  Found ${routes.length} routes in database\n`);

    let updatedCount = 0;
    let matchedOrigins = 0;
    let matchedDestinations = 0;

    for (const route of routes) {
      const updates = {};
      let hasUpdates = false;

      // Try to match origin location code
      const originLocation = locationMap[route.origin];
      if (originLocation) {
        matchedOrigins++;
        updates.originAddress = originLocation.address;
        updates.originCity = originLocation.city;
        updates.originState = originLocation.state;
        updates.originZipCode = originLocation.zipCode;
        updates.originTimeZone = originLocation.timeZone;
        updates.originLatitude = originLocation.latitude;
        updates.originLongitude = originLocation.longitude;
        hasUpdates = true;
      }

      // Try to match destination location code
      const destinationLocation = locationMap[route.destination];
      if (destinationLocation) {
        matchedDestinations++;
        updates.destinationAddress = destinationLocation.address;
        updates.destinationCity = destinationLocation.city;
        updates.destinationState = destinationLocation.state;
        updates.destinationZipCode = destinationLocation.zipCode;
        updates.destinationTimeZone = destinationLocation.timeZone;
        updates.destinationLatitude = destinationLocation.latitude;
        updates.destinationLongitude = destinationLocation.longitude;
        hasUpdates = true;
      }

      // Update route if we have location data
      if (hasUpdates) {
        await prisma.route.update({
          where: { id: route.id },
          data: updates
        });
        
        updatedCount++;
        console.log(`✅ Updated route #${route.id}: ${route.name}`);
        if (originLocation) {
          console.log(`   Origin: ${route.origin} → ${originLocation.city}, ${originLocation.state} (${originLocation.timeZone})`);
        }
        if (destinationLocation) {
          console.log(`   Destination: ${route.destination} → ${destinationLocation.city}, ${destinationLocation.state} (${destinationLocation.timeZone})`);
        }
        console.log('');
      }
    }

    console.log('📈 Import Summary:');
    console.log(`  Total routes: ${routes.length}`);
    console.log(`  Routes updated: ${updatedCount}`);
    console.log(`  Origin locations matched: ${matchedOrigins}`);
    console.log(`  Destination locations matched: ${matchedDestinations}`);
    console.log(`  Available location codes: ${Object.keys(locationMap).length}`);
    
    console.log('\n🎯 Available location codes:');
    console.log(Object.keys(locationMap).sort().join(', '));

    console.log('\n✅ Location data import completed successfully!');

  } catch (error) {
    console.error('❌ Error importing location data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importLocationData()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });