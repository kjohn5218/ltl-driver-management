const { PrismaClient } = require('@prisma/client');
const driversData = require('./driversData');

const prisma = new PrismaClient();

async function seedDrivers() {
  console.log('Starting driver seeding process...');
  
  try {
    // Get all carriers to create a mapping
    const carriers = await prisma.carrier.findMany({
      select: { id: true, name: true }
    });
    
    console.log(`Found ${carriers.length} carriers in database`);
    
    // Create a mapping of carrier names to IDs (case-insensitive)
    const carrierMap = new Map();
    carriers.forEach(carrier => {
      carrierMap.set(carrier.name.toLowerCase(), carrier.id);
    });
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const driverData of driversData) {
      try {
        // Find carrier ID
        const carrierId = carrierMap.get(driverData.carrier.toLowerCase());
        
        if (!carrierId) {
          console.log(`⚠️  Carrier not found: ${driverData.carrier} (skipping driver ${driverData.name})`);
          skipped++;
          continue;
        }
        
        // Check if driver already exists
        const existingDriver = await prisma.carrierDriver.findFirst({
          where: {
            carrierId: carrierId,
            name: driverData.name,
            OR: driverData.number ? [{ number: driverData.number }] : undefined
          }
        });
        
        if (existingDriver) {
          console.log(`ℹ️  Driver already exists: ${driverData.name} (${driverData.carrier})`);
          skipped++;
          continue;
        }
        
        // Create the driver
        await prisma.carrierDriver.create({
          data: {
            carrierId: carrierId,
            name: driverData.name,
            number: driverData.number || null,
            phoneNumber: driverData.phone || null,
            active: driverData.active
          }
        });
        
        console.log(`✅ Created driver: ${driverData.name} (${driverData.carrier}) - #${driverData.number}`);
        created++;
        
      } catch (error) {
        console.error(`❌ Error creating driver ${driverData.name}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Seeding Summary:');
    console.log(`✅ Created: ${created} drivers`);
    console.log(`⚠️  Skipped: ${skipped} drivers`);
    console.log(`❌ Errors: ${errors} drivers`);
    console.log(`📋 Total processed: ${driversData.length} drivers`);
    
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding function
seedDrivers()
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });