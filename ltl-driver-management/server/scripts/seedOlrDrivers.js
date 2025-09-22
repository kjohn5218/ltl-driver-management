const { PrismaClient } = require('@prisma/client');
const olrDriversData = require('./olrDriversData');

const prisma = new PrismaClient();

async function seedOlrDrivers() {
  console.log('Starting OLR TRANSPORTATION INC drivers seeding...');
  
  try {
    // Find OLR TRANSPORTATION INC carrier
    const olrCarrier = await prisma.carrier.findFirst({
      where: {
        name: {
          contains: 'OLR TRANSPORTATION',
          mode: 'insensitive'
        }
      }
    });

    if (!olrCarrier) {
      console.log('OLR TRANSPORTATION INC carrier not found. Creating carrier...');
      // Create the carrier if it doesn't exist
      const newCarrier = await prisma.carrier.create({
        data: {
          name: 'OLR TRANSPORTATION INC',
          contactEmail: 'info@olrtransportation.com',
          status: 'ACTIVE'
        }
      });
      console.log(`Created carrier: ${newCarrier.name} (ID: ${newCarrier.id})`);
      
      await seedDriversForCarrier(newCarrier.id, newCarrier.name);
    } else {
      console.log(`Found carrier: ${olrCarrier.name} (ID: ${olrCarrier.id})`);
      await seedDriversForCarrier(olrCarrier.id, olrCarrier.name);
    }

  } catch (error) {
    console.error('Error seeding OLR drivers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedDriversForCarrier(carrierId, carrierName) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const driverData of olrDriversData) {
    try {
      // Check if driver already exists for this carrier with this number
      const existingDriver = await prisma.carrierDriver.findFirst({
        where: {
          carrierId: carrierId,
          number: driverData.number
        }
      });

      if (existingDriver) {
        // Update existing driver
        await prisma.carrierDriver.update({
          where: { id: existingDriver.id },
          data: {
            name: driverData.name,
            phoneNumber: driverData.phone
          }
        });
        updated++;
        console.log(`Updated driver #${driverData.number}: ${driverData.name}`);
      } else {
        // Create new driver
        await prisma.carrierDriver.create({
          data: {
            carrierId: carrierId,
            name: driverData.name,
            number: driverData.number,
            phoneNumber: driverData.phone,
            active: true
          }
        });
        created++;
        console.log(`Created driver #${driverData.number}: ${driverData.name}`);
      }
    } catch (error) {
      console.error(`Error processing driver ${driverData.name}:`, error.message);
      skipped++;
    }
  }

  console.log(`\n--- OLR TRANSPORTATION INC Seeding Summary ---`);
  console.log(`Carrier: ${carrierName}`);
  console.log(`Total drivers processed: ${olrDriversData.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

// Run the seeding
if (require.main === module) {
  seedOlrDrivers()
    .then(() => {
      console.log('OLR drivers seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('OLR drivers seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedOlrDrivers;