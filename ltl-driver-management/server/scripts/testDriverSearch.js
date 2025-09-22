const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDriverSearch() {
  console.log('Testing driver search functionality...\n');
  
  try {
    // Test search for "OLR" which should find drivers under OLR TRANSPORTATION INC
    console.log('1. Searching for "OLR":');
    const olrSearch = await prisma.carrierDriver.findMany({
      where: {
        OR: [
          { name: { contains: 'OLR', mode: 'insensitive' } },
          { phoneNumber: { contains: 'OLR', mode: 'insensitive' } },
          { email: { contains: 'OLR', mode: 'insensitive' } },
          { licenseNumber: { contains: 'OLR', mode: 'insensitive' } },
          { number: { contains: 'OLR', mode: 'insensitive' } },
          { carrier: { name: { contains: 'OLR', mode: 'insensitive' } } }
        ]
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      take: 5
    });

    console.log(`Found ${olrSearch.length} drivers when searching for "OLR"`);
    olrSearch.forEach(driver => {
      console.log(`  - ${driver.name} (${driver.carrier?.name})`);
    });
    console.log('');

    // Test search for "TRANSPORTATION"
    console.log('2. Searching for "TRANSPORTATION":');
    const transportationSearch = await prisma.carrierDriver.findMany({
      where: {
        OR: [
          { name: { contains: 'TRANSPORTATION', mode: 'insensitive' } },
          { phoneNumber: { contains: 'TRANSPORTATION', mode: 'insensitive' } },
          { email: { contains: 'TRANSPORTATION', mode: 'insensitive' } },
          { licenseNumber: { contains: 'TRANSPORTATION', mode: 'insensitive' } },
          { number: { contains: 'TRANSPORTATION', mode: 'insensitive' } },
          { carrier: { name: { contains: 'TRANSPORTATION', mode: 'insensitive' } } }
        ]
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      take: 5
    });

    console.log(`Found ${transportationSearch.length} drivers when searching for "TRANSPORTATION"`);
    transportationSearch.forEach(driver => {
      console.log(`  - ${driver.name} (${driver.carrier?.name})`);
    });
    console.log('');

    // Test search for a specific driver name
    console.log('3. Searching for "GILLES":');
    const gillesSearch = await prisma.carrierDriver.findMany({
      where: {
        OR: [
          { name: { contains: 'GILLES', mode: 'insensitive' } },
          { phoneNumber: { contains: 'GILLES', mode: 'insensitive' } },
          { email: { contains: 'GILLES', mode: 'insensitive' } },
          { licenseNumber: { contains: 'GILLES', mode: 'insensitive' } },
          { number: { contains: 'GILLES', mode: 'insensitive' } },
          { carrier: { name: { contains: 'GILLES', mode: 'insensitive' } } }
        ]
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    });

    console.log(`Found ${gillesSearch.length} drivers when searching for "GILLES"`);
    gillesSearch.forEach(driver => {
      console.log(`  - ${driver.name} (${driver.carrier?.name})`);
    });
    console.log('');

    console.log('✅ Search functionality test completed!');

  } catch (error) {
    console.error('Error testing driver search:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDriverSearch();