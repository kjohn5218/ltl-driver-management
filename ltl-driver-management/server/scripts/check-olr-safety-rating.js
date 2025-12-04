const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOLRSafetyRating() {
  try {
    // First, let's find any carrier with OLD LEGION in the name
    const carriers = await prisma.carrier.findMany({
      where: { 
        name: { contains: 'OLD LEGION' }
      },
      take: 5
    });
    
    if (carriers.length === 0) {
      console.log('No carriers found with OLD LEGION in the name');
      
      // Let's check a carrier we know has MCP data
      const mcpCarrier = await prisma.carrier.findFirst({
        where: {
          mcpMonitored: true,
          mcpSafetyRating: { not: null }
        }
      });
      
      if (mcpCarrier) {
        console.log('\nFound an MCP monitored carrier:');
        console.log('  - Name:', mcpCarrier.name);
        console.log('  - DOT:', mcpCarrier.dotNumber);
        console.log('  - Safety Rating:', mcpCarrier.safetyRating);
        console.log('  - MCP Safety Rating:', mcpCarrier.mcpSafetyRating);
        console.log('  - MCP Monitored:', mcpCarrier.mcpMonitored);
        console.log('  - MCP Risk Score:', mcpCarrier.mcpRiskScore);
      }
      return;
    }
    
    console.log(`Found ${carriers.length} carriers with OLD LEGION in the name:\n`);
    
    carriers.forEach(carrier => {
    
      console.log('Carrier:', carrier.name);
      console.log('  - ID:', carrier.id);
      console.log('  - DOT:', carrier.dotNumber);
      console.log('  - Safety Rating:', carrier.safetyRating);
      console.log('  - MCP Safety Rating:', carrier.mcpSafetyRating);
      console.log('  - MCP Monitored:', carrier.mcpMonitored);
      console.log('  - MCP Last Sync:', carrier.mcpLastSync);
      console.log('  - MCP Authority Status:', carrier.mcpAuthorityStatus);
      console.log('  - MCP Risk Score:', carrier.mcpRiskScore);
      console.log('  - MCP Packet Completed:', carrier.mcpPacketCompleted);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error checking OLR safety rating:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOLRSafetyRating();