const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updatePacketStatus() {
  try {
    console.log('Updating carrier packet status...');
    
    const result = await prisma.$executeRaw`
      UPDATE carriers
      SET "mcpPacketStatus" = CASE 
          WHEN "mcpPacketCompleted" = true THEN 'Completed'
          ELSE 'Not Completed'
      END
      WHERE "mcpPacketStatus" IS NULL
    `;
    
    console.log(`Updated ${result} carriers with packet status.`);
  } catch (error) {
    console.error('Error updating packet status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePacketStatus();