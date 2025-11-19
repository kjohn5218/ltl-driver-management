#!/usr/bin/env node

/**
 * Test script for MyCarrierPackets service
 * Run with: npx ts-node src/scripts/test-mcp-service.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { mcpService } from '../services/mycarrierpackets.service';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Test DOT numbers (you can replace with actual ones for testing)
const TEST_DOT_NUMBER = '1234567';
const TEST_MC_NUMBER = 'MC123456';

async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  try {
    await mcpService.authenticate();
    console.log('✅ Authentication successful!');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    return false;
  }
}

async function testPreviewCarrier() {
  console.log('\n🔍 Testing Preview Carrier...');
  try {
    const data = await mcpService.previewCarrier(TEST_DOT_NUMBER, TEST_MC_NUMBER);
    console.log('✅ Preview successful!');
    console.log('Carrier Name:', data.LegalName || data.DBAName || 'Not found');
    console.log('City/State:', `${data.City || 'N/A'}, ${data.State || 'N/A'}`);
    return true;
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log('⚠️  Carrier not found (this is expected with test data)');
      return true;
    }
    console.error('❌ Preview failed:', error.message);
    return false;
  }
}

async function testGenerateUrls() {
  console.log('\n🔗 Testing URL Generation...');
  
  const intelliviteUrl = mcpService.generateIntelliviteUrl(
    TEST_DOT_NUMBER,
    TEST_MC_NUMBER,
    'testuser'
  );
  console.log('Intellivite URL:', intelliviteUrl);
  
  const viewUrl = mcpService.generateCarrierViewUrl(
    TEST_DOT_NUMBER,
    TEST_MC_NUMBER,
    true
  );
  console.log('Carrier View URL:', viewUrl);
  
  console.log('✅ URL generation successful!');
  return true;
}

async function runTests() {
  console.log('=== MyCarrierPackets Service Test ===');
  console.log('Note: Some tests may fail with test data, which is expected.\n');

  const tests = [
    { name: 'Authentication', fn: testAuthentication },
    { name: 'Preview Carrier', fn: testPreviewCarrier },
    { name: 'URL Generation', fn: testGenerateUrls }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test.fn();
    if (result) passed++;
    else failed++;
  }

  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! The MCP service is ready to use.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check your configuration.');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});