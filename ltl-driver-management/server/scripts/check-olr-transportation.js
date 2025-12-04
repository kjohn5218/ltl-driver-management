const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOLRTransportation() {
  try {
    console.log('Searching for OLR Transportation...\n');
    
    // Try different search patterns
    const searchPatterns = [
      { name: { contains: 'OLR' } },
      { name: { contains: 'OLD LEGION' } },
      { dotNumber: '3444851' }
    ];
    
    for (const pattern of searchPatterns) {
      const carriers = await prisma.carrier.findMany({
        where: pattern,
        select: {
          id: true,
          name: true,
          dotNumber: true,
          mcNumber: true,
          safetyRating: true,
          mcpSafetyRating: true,
          mcpMonitored: true,
          mcpLastSync: true,
          mcpAuthorityStatus: true,
          mcpRiskScore: true
        }
      });
      
      if (carriers.length > 0) {
        console.log(`Found ${carriers.length} carriers with pattern:`, pattern);
        carriers.forEach(carrier => {
          console.log('\nCarrier Details:');
          console.log('  - ID:', carrier.id);
          console.log('  - Name:', carrier.name);
          console.log('  - DOT:', carrier.dotNumber);
          console.log('  - MC:', carrier.mcNumber);
          console.log('  - Safety Rating:', carrier.safetyRating);
          console.log('  - MCP Safety Rating:', carrier.mcpSafetyRating);
          console.log('  - MCP Monitored:', carrier.mcpMonitored);
          console.log('  - MCP Last Sync:', carrier.mcpLastSync);
          console.log('  - MCP Authority Status:', carrier.mcpAuthorityStatus);
          console.log('  - MCP Risk Score:', carrier.mcpRiskScore);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOLRTransportation();