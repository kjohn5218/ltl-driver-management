const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

async function syncOLRViaAPI() {
  try {
    console.log('=== Syncing OLR via API Endpoint ===\n');
    
    // First show current state
    const carrier = await prisma.carrier.findFirst({
      where: { id: 3734 }
    });
    
    console.log('Before sync:');
    console.log('  - Safety Rating:', carrier.safetyRating);
    console.log('  - MCP Safety Rating:', carrier.mcpSafetyRating);
    console.log('  - Last Sync:', carrier.mcpLastSync);
    
    // Call sync endpoint
    console.log('\nCalling POST /carriers/3734/sync...');
    
    try {
      const response = await axios.post('http://localhost:3001/api/carriers/3734/sync');
      console.log('\nSync response:', response.data);
    } catch (error) {
      console.error('API call failed:', error.message);
      console.log('Make sure the server is running on port 3001');
    }
    
    // Check updated state
    const updatedCarrier = await prisma.carrier.findFirst({
      where: { id: 3734 }
    });
    
    console.log('\nAfter sync:');
    console.log('  - Safety Rating:', updatedCarrier.safetyRating);
    console.log('  - MCP Safety Rating:', updatedCarrier.mcpSafetyRating);
    console.log('  - Last Sync:', updatedCarrier.mcpLastSync);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncOLRViaAPI();