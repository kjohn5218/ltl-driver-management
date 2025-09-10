const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedLocations() {
  try {
    console.log('🚀 Starting location seeding from existing route data...\\n');

    // Get all unique origins and destinations from routes
    const routes = await prisma.route.findMany({
      select: {
        origin: true,
        destination: true,
        originAddress: true,
        originCity: true,
        originState: true,
        originZipCode: true,
        originContact: true,
        originTimeZone: true,
        originLatitude: true,
        originLongitude: true,
        destinationAddress: true,
        destinationCity: true,
        destinationState: true,
        destinationZipCode: true,
        destinationContact: true,
        destinationTimeZone: true,
        destinationLatitude: true,
        destinationLongitude: true
      }
    });

    console.log(`📊 Found ${routes.length} routes in database\\n`);

    // Collect unique locations
    const locationMap = new Map();

    routes.forEach(route => {
      // Process origin
      if (route.origin && !locationMap.has(route.origin)) {
        locationMap.set(route.origin, {
          code: route.origin,
          address: route.originAddress,
          city: route.originCity,
          state: route.originState,
          zipCode: route.originZipCode,
          contact: route.originContact,
          timeZone: route.originTimeZone,
          latitude: route.originLatitude,
          longitude: route.originLongitude
        });
      }

      // Process destination
      if (route.destination && !locationMap.has(route.destination)) {
        locationMap.set(route.destination, {
          code: route.destination,
          address: route.destinationAddress,
          city: route.destinationCity,
          state: route.destinationState,
          zipCode: route.destinationZipCode,
          contact: route.destinationContact,
          timeZone: route.destinationTimeZone,
          latitude: route.destinationLatitude,
          longitude: route.destinationLongitude
        });
      }
    });

    console.log(`📍 Found ${locationMap.size} unique locations to seed\\n`);

    let created = 0;
    let skipped = 0;

    // Insert locations
    for (const [code, locationData] of locationMap) {
      try {
        // Check if location already exists
        const existingLocation = await prisma.location.findUnique({
          where: { code }
        });

        if (existingLocation) {
          skipped++;
          console.log(`⚠️  Skipped existing location: ${code}`);
          continue;
        }

        // Create new location
        await prisma.location.create({
          data: {
            code: locationData.code,
            address: locationData.address,
            city: locationData.city,
            state: locationData.state,
            zipCode: locationData.zipCode,
            contact: locationData.contact,
            timeZone: locationData.timeZone,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            active: true
          }
        });

        created++;
        console.log(`✅ Created location: ${code} - ${locationData.city || 'Unknown'}, ${locationData.state || 'Unknown'}`);
      } catch (error) {
        console.error(`❌ Error creating location ${code}:`, error.message);
      }
    }

    console.log('\\n📈 Seeding Summary:');
    console.log(`  Unique locations found: ${locationMap.size}`);
    console.log(`  Locations created: ${created}`);
    console.log(`  Locations skipped (already exist): ${skipped}`);
    
    console.log('\\n✅ Location seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding locations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedLocations()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });