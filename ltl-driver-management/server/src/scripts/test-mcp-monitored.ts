import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testMonitoredCarrierData() {
  const username = process.env.MYCARRIERPACKETS_USERNAME;
  const password = process.env.MYCARRIERPACKETS_PASSWORD;
  const apiUrl = process.env.MYCARRIERPACKETS_API_URL || 'https://api.mycarrierpackets.com';

  console.log('Testing MCP MonitoredCarrierData endpoint...');

  try {
    // First authenticate
    console.log('\n1. Authenticating...');
    const authResponse = await axios.post(
      `${apiUrl}/token`,
      new URLSearchParams({
        grant_type: 'password',
        username: username!,
        password: password!
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    const accessToken = authResponse.data.access_token;
    console.log('✅ Authentication successful');

    // Test MonitoredCarrierData endpoint
    console.log('\n2. Testing MonitoredCarrierData endpoint...');
    const params = new URLSearchParams({
      pageNumber: '1',
      pageSize: '10'
    });

    try {
      const response = await axios.post(
        `${apiUrl}/api/v1/Carrier/MonitoredCarrierData?${params}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('✅ MonitoredCarrierData request successful!');
      console.log('\nResponse structure:');
      console.log('- Type:', typeof response.data);
      console.log('- Is Array:', Array.isArray(response.data));
      console.log('- Has pagination:', 'pagination' in response.data);
      
      if (Array.isArray(response.data)) {
        console.log('- Array length:', response.data.length);
        if (response.data.length > 0) {
          console.log('\nFirst carrier sample:');
          const firstCarrier = response.data[0];
          console.log(JSON.stringify(firstCarrier, null, 2));
        }
      } else if (response.data && typeof response.data === 'object') {
        console.log('\nResponse keys:', Object.keys(response.data));
        console.log('\nFull response:');
        console.log(JSON.stringify(response.data, null, 2));
      }
      
    } catch (error: any) {
      console.error('\n❌ MonitoredCarrierData request failed!');
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Status Text:', error.response.statusText);
        console.error('Response:', error.response.data);
        
        // Check if it's a 404 - might mean wrong endpoint
        if (error.response.status === 404) {
          console.error('\nPossible issues:');
          console.error('- The endpoint URL might be incorrect');
          console.error('- The API version might be different');
          console.error('- You might not have access to this endpoint');
        }
      } else {
        console.error('Error:', error.message);
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);
  }
}

testMonitoredCarrierData();