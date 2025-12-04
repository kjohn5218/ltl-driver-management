const axios = require('axios');

// Test the actual API response for OLR Transportation
async function testOLRApiResponse() {
  try {
    console.log('Testing API response for OLR Transportation (ID: 3734)...\n');
    
    // Update these values based on your local setup
    const API_URL = 'http://localhost:3001/api';
    const CARRIER_ID = 3734;
    
    // Test getCarrierById endpoint
    console.log(`1. Testing GET /carriers/${CARRIER_ID}`);
    try {
      const response = await axios.get(`${API_URL}/carriers/${CARRIER_ID}`);
      const carrier = response.data;
      
      console.log('\nCarrier API Response:');
      console.log('  - Name:', carrier.name);
      console.log('  - DOT:', carrier.dotNumber);
      console.log('  - Safety Rating:', carrier.safetyRating);
      console.log('  - MCP Safety Rating:', carrier.mcpSafetyRating);
      console.log('  - MCP Monitored:', carrier.mcpMonitored);
      console.log('  - MCP Authority Status:', carrier.mcpAuthorityStatus);
      console.log('  - MCP Risk Score:', carrier.mcpRiskScore);
      
      console.log('\nAll safety-related fields in response:');
      Object.keys(carrier).forEach(key => {
        if (key.toLowerCase().includes('safety') || key.toLowerCase().includes('rating')) {
          console.log(`  - ${key}:`, carrier[key]);
        }
      });
      
    } catch (error) {
      console.error('Error calling carrier API:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
    
    // Test getMCPStatus endpoint
    console.log(`\n2. Testing GET /carriers/${CARRIER_ID}/mcp/status`);
    try {
      const mcpResponse = await axios.get(`${API_URL}/carriers/${CARRIER_ID}/mcp/status`);
      const mcpStatus = mcpResponse.data;
      
      console.log('\nMCP Status API Response:');
      console.log('  - Success:', mcpStatus.success);
      if (mcpStatus.mcpStatus) {
        console.log('  - Is Configured:', mcpStatus.mcpStatus.isConfigured);
        console.log('  - Is Monitored:', mcpStatus.mcpStatus.isMonitored);
        console.log('  - Safety Rating:', mcpStatus.mcpStatus.safetyRating);
        console.log('  - Authority Status:', mcpStatus.mcpStatus.authorityStatus);
        console.log('  - Risk Score:', mcpStatus.mcpStatus.riskScore);
      }
      
    } catch (error) {
      console.error('Error calling MCP status API:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testOLRApiResponse();