const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixOLRSafetyRating() {
  try {
    console.log('=== Fixing OLR Transportation Safety Rating ===\n');
    
    // Update OLR Transportation with the correct safety rating
    const result = await prisma.carrier.update({
      where: { id: 3734 },
      data: {
        safetyRating: 'Acceptable',
        mcpSafetyRating: 'Acceptable'
      }
    });
    
    console.log('✅ Updated OLR Transportation:');
    console.log('  - Name:', result.name);
    console.log('  - Safety Rating:', result.safetyRating);
    console.log('  - MCP Safety Rating:', result.mcpSafetyRating);
    
    console.log('\n✅ Safety rating has been fixed to "Acceptable"');
    console.log('The UI should now display the correct safety rating.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOLRSafetyRating();