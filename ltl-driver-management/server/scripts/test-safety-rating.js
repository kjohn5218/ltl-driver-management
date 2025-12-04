const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSafetyRatings() {
  try {
    console.log('Testing Safety Rating fields in the database...\n');
    
    // Get carriers with safety ratings
    const carriers = await prisma.carrier.findMany({
      where: {
        OR: [
          { safetyRating: { not: null } },
          { mcpSafetyRating: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        dotNumber: true,
        safetyRating: true,
        mcpSafetyRating: true,
        mcpMonitored: true,
        mcpLastSync: true
      },
      take: 10
    });
    
    console.log(`Found ${carriers.length} carriers with safety ratings:\n`);
    
    carriers.forEach(carrier => {
      console.log(`Carrier: ${carrier.name} (DOT: ${carrier.dotNumber})`);
      console.log(`  - Safety Rating: ${carrier.safetyRating || 'null'}`);
      console.log(`  - MCP Safety Rating: ${carrier.mcpSafetyRating || 'null'}`);
      console.log(`  - MCP Monitored: ${carrier.mcpMonitored}`);
      console.log(`  - Last Sync: ${carrier.mcpLastSync ? new Date(carrier.mcpLastSync).toLocaleString() : 'Never'}`);
      console.log('');
    });
    
    // Count carriers with each type of rating
    const withSafetyRating = await prisma.carrier.count({
      where: { safetyRating: { not: null } }
    });
    
    const withMCPSafetyRating = await prisma.carrier.count({
      where: { mcpSafetyRating: { not: null } }
    });
    
    const withBothRatings = await prisma.carrier.count({
      where: {
        AND: [
          { safetyRating: { not: null } },
          { mcpSafetyRating: { not: null } }
        ]
      }
    });
    
    console.log('Summary:');
    console.log(`  - Carriers with safetyRating: ${withSafetyRating}`);
    console.log(`  - Carriers with mcpSafetyRating: ${withMCPSafetyRating}`);
    console.log(`  - Carriers with both ratings: ${withBothRatings}`);
    
  } catch (error) {
    console.error('Error testing safety ratings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSafetyRatings();