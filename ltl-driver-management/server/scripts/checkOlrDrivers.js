const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOlrDrivers() {
  console.log('Checking OLR Transportation drivers...\n');
  
  try {
    // Find all carriers with OLR in the name
    const olrCarriers = await prisma.carrier.findMany({
      where: {
        name: {
          contains: 'OLR',
          mode: 'insensitive'
        }
      }
    });

    console.log('Found OLR carriers:');
    olrCarriers.forEach(carrier => {
      console.log(`- ID: ${carrier.id}, Name: "${carrier.name}"`);
    });
    console.log('');

    // Get drivers for each OLR carrier
    for (const carrier of olrCarriers) {
      const drivers = await prisma.carrierDriver.findMany({
        where: {
          carrierId: carrier.id
        },
        orderBy: {
          number: 'asc'
        }
      });

      console.log(`Drivers for "${carrier.name}" (ID: ${carrier.id}):`);
      console.log(`Total: ${drivers.length} drivers`);
      
      if (drivers.length > 0) {
        console.log('Sample drivers:');
        drivers.slice(0, 5).forEach(driver => {
          console.log(`  - #${driver.number || 'N/A'}: ${driver.name} (${driver.phoneNumber || 'No phone'})`);
        });
        if (drivers.length > 5) {
          console.log(`  ... and ${drivers.length - 5} more`);
        }
      }
      console.log('');
    }

    // Check if there are any drivers assigned to "OLR TRANSPORTATION" (without INC)
    const olrTransportationDrivers = await prisma.carrierDriver.findMany({
      where: {
        carrier: {
          name: {
            equals: 'OLR TRANSPORTATION',
            mode: 'insensitive'
          }
        }
      },
      include: {
        carrier: true
      }
    });

    if (olrTransportationDrivers.length > 0) {
      console.log('⚠️  Found drivers assigned to "OLR TRANSPORTATION" (without INC):');
      olrTransportationDrivers.forEach(driver => {
        console.log(`  - ${driver.name} (Carrier: "${driver.carrier.name}", ID: ${driver.carrier.id})`);
      });
    } else {
      console.log('✅ No drivers found assigned to "OLR TRANSPORTATION" (without INC)');
    }

  } catch (error) {
    console.error('Error checking OLR drivers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkOlrDrivers();