const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMCPFields() {
  try {
    console.log('Checking MCP field status...\n');
    
    // Count carriers with various MCP states
    const totalCarriers = await prisma.carrier.count();
    const mcpMonitored = await prisma.carrier.count({
      where: { mcpMonitored: true }
    });
    const packetCompleted = await prisma.carrier.count({
      where: { mcpPacketCompleted: true }
    });
    const hasPacketStatus = await prisma.carrier.count({
      where: { mcpPacketStatus: { not: null } }
    });
    const nullPacketStatus = await prisma.carrier.count({
      where: { mcpPacketStatus: null }
    });
    
    console.log(`Total carriers: ${totalCarriers}`);
    console.log(`MCP monitored: ${mcpMonitored}`);
    console.log(`Packet completed (boolean): ${packetCompleted}`);
    console.log(`Has packet status (string): ${hasPacketStatus}`);
    console.log(`Null packet status: ${nullPacketStatus}`);
    
    // Show some sample carriers with their MCP fields
    console.log('\nSample carriers with MCP fields:');
    const sampleCarriers = await prisma.carrier.findMany({
      where: {
        OR: [
          { mcpMonitored: true },
          { mcpPacketCompleted: true },
          { mcpPacketStatus: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        dotNumber: true,
        mcpMonitored: true,
        mcpPacketCompleted: true,
        mcpPacketStatus: true,
        mcpPacketCompletedAt: true
      },
      take: 10
    });
    
    for (const carrier of sampleCarriers) {
      console.log(`\nCarrier: ${carrier.name} (DOT: ${carrier.dotNumber})`);
      console.log(`  Monitored: ${carrier.mcpMonitored}`);
      console.log(`  Packet Completed: ${carrier.mcpPacketCompleted}`);
      console.log(`  Packet Status: ${carrier.mcpPacketStatus}`);
      console.log(`  Completed At: ${carrier.mcpPacketCompletedAt || 'N/A'}`);
    }
    
    // Check for mismatches
    console.log('\nChecking for potential mismatches:');
    
    const completedButWrongStatus = await prisma.carrier.count({
      where: {
        mcpPacketCompleted: true,
        mcpPacketStatus: { not: 'Completed' }
      }
    });
    
    const notCompletedButCompletedStatus = await prisma.carrier.count({
      where: {
        mcpPacketCompleted: false,
        mcpPacketStatus: 'Completed'
      }
    });
    
    console.log(`Completed (boolean) but status not 'Completed': ${completedButWrongStatus}`);
    console.log(`Not completed (boolean) but status is 'Completed': ${notCompletedButCompletedStatus}`);
    
  } catch (error) {
    console.error('Error checking MCP fields:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMCPFields();