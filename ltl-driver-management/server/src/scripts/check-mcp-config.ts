#!/usr/bin/env node

/**
 * Script to verify MyCarrierPackets configuration
 * Run with: npx ts-node src/scripts/check-mcp-config.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { getMCPConfig, isMCPConfigured, logMCPConfigStatus } from '../config/mcp.config';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('\n=== MyCarrierPackets Configuration Check ===\n');

// Display configuration status
logMCPConfigStatus();

console.log('\n=== Configuration Details ===\n');

if (isMCPConfigured()) {
  console.log('✅ MyCarrierPackets is properly configured!');
  
  const config = getMCPConfig();
  console.log('\nConfiguration summary:');
  console.log(`- API URL: ${config.apiUrl}`);
  console.log(`- Frontend URL: ${config.frontendUrl}`);
  console.log(`- Customer ID: ${config.customerId || 'Not set (optional)'}`);
  console.log(`- Credentials: Username and password are set`);
  
  console.log('\n📝 Next steps:');
  console.log('1. Verify your credentials are correct by testing an API call');
  console.log('2. Ensure your Customer ID matches your MCP account');
  console.log('3. You can find your credentials at: https://mycarrierpackets.com/IntegrationTools');
} else {
  console.log('❌ MyCarrierPackets is NOT properly configured!');
  console.log('\n📝 To fix this:');
  console.log('1. Log in to MyCarrierPackets');
  console.log('2. Go to https://mycarrierpackets.com/IntegrationTools');
  console.log('3. Copy your integration credentials');
  console.log('4. Update your .env file with the following variables:');
  console.log('   - MYCARRIERPACKETS_API_KEY');
  console.log('   - MYCARRIERPACKETS_USERNAME');
  console.log('   - MYCARRIERPACKETS_PASSWORD');
  console.log('   - MYCARRIERPACKETS_CUSTOMER_ID (your Customer Intellivite ID)');
}

console.log('\n');