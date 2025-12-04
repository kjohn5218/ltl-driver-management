const axios = require('axios');

// You may need to update these values
const API_URL = 'http://localhost:3001/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''; // Add your auth token if needed

async function testCarrierAPI() {
  try {
    // Get carriers list
    console.log('Fetching carriers from API...\n');
    
    const response = await axios.get(`${API_URL}/carriers?limit=5`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.carriers && response.data.carriers.length > 0) {
      console.log(`Found ${response.data.carriers.length} carriers:\n`);
      
      response.data.carriers.forEach(carrier => {
        console.log(`Carrier: ${carrier.name} (ID: ${carrier.id})`);
        console.log(`  - DOT: ${carrier.dotNumber || 'N/A'}`);
        console.log(`  - Safety Rating: ${carrier.safetyRating || 'null'}`);
        console.log(`  - MCP Safety Rating: ${carrier.mcpSafetyRating || 'null'}`);
        console.log(`  - MCP Monitored: ${carrier.mcpMonitored}`);
        console.log('');
      });
      
      // Test individual carrier endpoint
      const firstCarrier = response.data.carriers[0];
      console.log(`\nFetching details for carrier ${firstCarrier.id}...`);
      
      const detailResponse = await axios.get(`${API_URL}/carriers/${firstCarrier.id}`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const detail = detailResponse.data;
      console.log(`\nDetailed data for ${detail.name}:`);
      console.log(`  - Safety Rating: ${detail.safetyRating || 'null'}`);
      console.log(`  - MCP Safety Rating: ${detail.mcpSafetyRating || 'null'}`);
      console.log(`  - All MCP fields present: ${detail.mcpMonitored !== undefined ? 'Yes' : 'No'}`);
      
    } else {
      console.log('No carriers found in the API response');
    }
    
  } catch (error) {
    console.error('Error testing carrier API:');
    if (error.response) {
      console.error('  - Status:', error.response.status);
      console.error('  - Message:', error.response.data?.message || error.response.statusText);
    } else {
      console.error('  -', error.message);
    }
    console.error('\nMake sure the server is running on port 3001');
  }
}

testCarrierAPI();