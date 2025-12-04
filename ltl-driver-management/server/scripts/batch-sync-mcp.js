#!/usr/bin/env node

/**
 * Batch sync all carriers with MCP
 * This script will use the batchUpdateCarriers method to sync all monitored carriers
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the MCP service
const { MyCarrierPacketsService } = require('../dist/services/mycarrierpackets.service');
const { getMCPConfig, isMCPConfigured } = require('../dist/config/mcp.config');

async function batchSync() {
  console.log('========================================');
  console.log('Batch MCP Carrier Sync');
  console.log('========================================\n');

  try {
    // Check if MCP is configured
    if (!isMCPConfigured()) {
      console.log('⚠️  MCP is not configured!');
      console.log('Please set the following environment variables:');
      console.log('  - MCP_API_URL');
      console.log('  - MCP_USERNAME');
      console.log('  - MCP_PASSWORD');
      console.log('  - MCP_CUSTOMER_ID');
      console.log('  - MCP_FRONTEND_URL');
      process.exit(1);
    }

    console.log('1. Starting batch sync with MCP...');
    const mcpService = new MyCarrierPacketsService();
    
    try {
      // Run the batch update
      const results = await mcpService.batchUpdateCarriers();
      
      console.log('\n2. Batch Sync Results:');
      console.log('----------------------');
      console.log(`  Total Processed: ${results.processed}`);
      console.log(`  Successfully Updated: ${results.updated}`);
      console.log(`  Errors: ${results.errors}`);
      
      if (results.errors > 0) {
        console.log('\n3. Errors:');
        const errors = results.details.filter(d => d.status === 'error');
        errors.forEach((error, index) => {
          console.log(`  ${index + 1}. DOT ${error.dotNumber}: ${error.message}`);
        });
      }
      
      // Show specific update for OLR if present
      const olrUpdate = results.details.find(d => d.dotNumber === '1790872');
      if (olrUpdate) {
        console.log('\n4. OLR Transportation Update:');
        console.log(`  Status: ${olrUpdate.status}`);
        if (olrUpdate.message) {
          console.log(`  Message: ${olrUpdate.message}`);
        }
      }
      
      // Check completed packets as well
      console.log('\n5. Checking for recently completed packets...');
      const syncResults = await mcpService.checkAndSyncCompletedPackets();
      
      console.log('\nCompleted Packets Sync:');
      console.log('----------------------');
      console.log(`  Checked: ${syncResults.checked}`);
      console.log(`  Synced: ${syncResults.synced}`);
      console.log(`  New Packets: ${syncResults.newPackets}`);
      console.log(`  Errors: ${syncResults.errors}`);
      
      // Show OLR if found in completed packets
      const olrCompleted = syncResults.details.find(d => d.dotNumber === '1790872');
      if (olrCompleted) {
        console.log('\n  OLR Transportation in completed packets:');
        console.log(`    Status: ${olrCompleted.status}`);
        console.log(`    Message: ${olrCompleted.message}`);
      }
      
      console.log('\n✅ Batch sync completed successfully!');
      
    } catch (mcpError) {
      console.error('\n❌ Error during batch sync:', mcpError.message);
      if (mcpError.statusCode) {
        console.error('Status Code:', mcpError.statusCode);
      }
      if (mcpError.details) {
        console.error('Details:', JSON.stringify(mcpError.details, null, 2));
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the batch sync
batchSync().catch(console.error);