const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPacketStatus() {
  try {
    // Count carriers by packet status
    const statusCounts = await prisma.carrier.groupBy({
      by: ['mcpPacketStatus'],
      _count: {
        mcpPacketStatus: true
      }
    });
    
    console.log('Carrier counts by packet status:');
    statusCounts.forEach(item => {
      console.log(`- ${item.mcpPacketStatus || 'NULL'}: ${item._count.mcpPacketStatus}`);
    });
    
    // Show a few examples
    console.log('\nSample carriers with packet status:');
    const samples = await prisma.carrier.findMany({
      take: 5,
      where: {
        mcpPacketStatus: { not: null }
      },
      select: {
        id: true,
        name: true,
        mcpPacketCompleted: true,
        mcpPacketStatus: true,
        mcpSafetyRating: true
      }
    });
    
    console.table(samples);
  } catch (error) {
    console.error('Error checking packet status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPacketStatus();