require('dotenv').config();
const axios = require('axios');

const MCP_API_KEY = process.env.MCP_API_KEY;
const MCP_API_URL = process.env.MCP_API_URL || 'https://api.mycarrierpackets.com/api/v1';
const MCP_USERNAME = process.env.MCP_USERNAME;

async function testOLRInMCP() {
  if (!MCP_API_KEY || !MCP_USERNAME) {
    console.error('Missing MCP_API_KEY or MCP_USERNAME in environment variables');
    process.exit(1);
  }

  try {
    console.log('Testing MCP API for OLR TRANSPORTATION INC (DOT: 1790872)...\n');
    
    // Try monitored endpoint
    console.log('1. Testing monitored carriers endpoint...');
    const monitoredResponse = await axios.get(`${MCP_API_URL}/MonitoredCarriers`, {
      params: {
        PageSize: 2500,
        PageNumber: 1
      },
      headers: {
        'x-api-key': MCP_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    const olrMonitored = monitoredResponse.data.find(c => 
      c.Identity?.usDOT === '1790872' || 
      c.Identity?.name?.includes('OLR TRANSPORTATION')
    );
    
    if (olrMonitored) {
      console.log('Found in monitored carriers:');
      console.log('  - Name:', olrMonitored.Identity?.name);
      console.log('  - DOT:', olrMonitored.Identity?.usDOT);
      console.log('  - Safety Rating:', olrMonitored.Safety?.rating);
      console.log('  - Risk Assessment:', JSON.stringify(olrMonitored.RiskAssessment, null, 2));
      console.log('  - Full Safety object:', JSON.stringify(olrMonitored.Safety, null, 2));
    } else {
      console.log('Not found in monitored carriers list');
    }
    
    // Try direct carrier lookup
    console.log('\n2. Testing direct carrier lookup...');
    const carrierResponse = await axios.get(`${MCP_API_URL}/Carriers`, {
      params: {
        searchTerm: '1790872',
        dotSearch: true
      },
      headers: {
        'x-api-key': MCP_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (carrierResponse.data && carrierResponse.data.length > 0) {
      const olrCarrier = carrierResponse.data[0];
      console.log('Found in carrier search:');
      console.log('  - Name:', olrCarrier.LegalName || olrCarrier.Identity?.name);
      console.log('  - DOT:', olrCarrier.USDot || olrCarrier.Identity?.usDOT);
      console.log('  - Full response structure:');
      console.log(JSON.stringify(olrCarrier, null, 2));
    } else {
      console.log('Not found in carrier search');
    }
    
  } catch (error) {
    console.error('Error testing MCP API:');
    if (error.response) {
      console.error('  - Status:', error.response.status);
      console.error('  - Message:', error.response.data);
    } else {
      console.error('  - Error:', error.message);
    }
  }
}

testOLRInMCP();