import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testMCPAuthentication() {
  const username = process.env.MYCARRIERPACKETS_USERNAME;
  const password = process.env.MYCARRIERPACKETS_PASSWORD;
  const apiUrl = process.env.MYCARRIERPACKETS_API_URL || 'https://api.mycarrierpackets.com';

  console.log('Testing MCP Authentication...');
  console.log('API URL:', apiUrl);
  console.log('Username:', username);
  console.log('Password:', password ? '***' : 'NOT SET');

  if (!username || !password) {
    console.error('❌ MCP credentials not configured in .env file');
    process.exit(1);
  }

  try {
    console.log('\nAttempting to authenticate with MCP API...');
    
    const response = await axios.post(
      `${apiUrl}/token`,
      new URLSearchParams({
        grant_type: 'password',
        username: username,
        password: password
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('\n✅ Authentication successful!');
    console.log('Token type:', response.data.token_type);
    console.log('Expires in:', response.data.expires_in, 'seconds');
    console.log('Access token:', response.data.access_token.substring(0, 20) + '...');
    
  } catch (error: any) {
    console.error('\n❌ Authentication failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    } else if (error.request) {
      console.error('No response received from API');
      console.error('Request details:', error.message);
    } else {
      console.error('Error:', error.message);
    }
    
    process.exit(1);
  }
}

testMCPAuthentication();