#!/usr/bin/env node

/**
 * Fix script to update OLR Transportation from MCP
 * DOT Number: 1790872
 * 
 * This script will:
 * 1. Fetch fresh data from MCP for OLR Transportation
 * 2. Update the database with the correct values
 * 3. Show before/after comparison
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the MCP service
const { MyCarrierPacketsService } = require('../dist/services/mycarrierpackets.service');
const { getMCPConfig, isMCPConfigured } = require('../dist/config/mcp.config');

const DOT_NUMBER = '1790872';

async function fixOlrSync() {
  console.log('========================================');
  console.log('Fix MCP Sync for OLR Transportation');
  console.log('DOT Number:', DOT_NUMBER);
  console.log('========================================\n');

  try {
    // Find carrier in database
    console.log('1. Finding carrier in database...');
    const carrier = await prisma.carrier.findFirst({
      where: { dotNumber: DOT_NUMBER }
    });

    if (!carrier) {
      console.error(`❌ Carrier with DOT ${DOT_NUMBER} not found in database!`);
      process.exit(1);
    }

    console.log('✅ Found carrier:', carrier.name);
    console.log('\n2. Current Database Values:');
    console.log('---------------------------');
    console.log(`  MCP Packet Status: ${carrier.mcpPacketStatus || 'Not Set'}`);
    console.log(`  MCP Packet Completed: ${carrier.mcpPacketCompleted}`);
    console.log(`  MCP Packet Completed At: ${carrier.mcpPacketCompletedAt || 'Never'}`);
    console.log(`  MCP Authority Status: ${carrier.mcpAuthorityStatus || 'Not Set'}`);
    console.log(`  MCP Last Sync: ${carrier.mcpLastSync || 'Never'}`);

    // Check if MCP is configured
    if (!isMCPConfigured()) {
      console.log('\n⚠️  MCP is not configured - using local sync only');
      
      // Fix based on mcpPacketCompleted flag
      const correctStatus = carrier.mcpPacketCompleted ? 'Completed' : 'Not Completed';
      
      if (carrier.mcpPacketStatus !== correctStatus) {
        console.log(`\n3. Fixing packet status: "${carrier.mcpPacketStatus}" → "${correctStatus}"`);
        
        await prisma.carrier.update({
          where: { id: carrier.id },
          data: { 
            mcpPacketStatus: correctStatus,
            mcpLastSync: new Date()
          }
        });
        
        console.log('✅ Packet status updated successfully');
      } else {
        console.log('\n✅ Packet status is already correct');
      }
      
      process.exit(0);
    }

    // Fetch fresh data from MCP
    console.log('\n3. Fetching fresh data from MCP...');
    const mcpService = new MyCarrierPacketsService();
    
    try {
      const carrierData = await mcpService.getCarrierData(DOT_NUMBER, carrier.mcNumber);
      
      console.log('✅ MCP data retrieved successfully');
      console.log('\n4. MCP Fresh Data:');
      console.log('------------------');
      console.log(`  Packet Completed: ${carrierData.mcpPacketCompleted}`);
      console.log(`  Packet Status: ${carrierData.mcpPacketStatus || 'N/A'}`);
      console.log(`  Packet Completed At: ${carrierData.mcpPacketCompletedAt || 'N/A'}`);
      console.log(`  Authority Status: ${carrierData.mcpAuthorityStatus || 'N/A'}`);
      console.log(`  Safety Rating: ${carrierData.safetyRating || 'N/A'}`);
      console.log(`  Risk Score: ${carrierData.mcpRiskScore || 'N/A'}`);
      
      // Update the carrier
      console.log('\n5. Updating database...');
      
      const updateData = {
        // Update basic info if different
        name: carrierData.name || carrier.name,
        dbaName: carrierData.dbaName || carrier.dbaName,
        scacCode: carrierData.scacCode || carrier.scacCode,
        
        // Update MCP fields
        mcpPacketCompleted: carrierData.mcpPacketCompleted,
        mcpPacketCompletedAt: carrierData.mcpPacketCompletedAt,
        mcpPacketStatus: carrierData.mcpPacketStatus || (carrierData.mcpPacketCompleted ? 'Completed' : 'Not Completed'),
        mcpAuthorityStatus: carrierData.mcpAuthorityStatus,
        mcpSafetyRating: carrierData.safetyRating,
        mcpRiskScore: carrierData.mcpRiskScore,
        mcpInsuranceExpiration: carrierData.mcpInsuranceExpiration,
        mcpLastSync: new Date(),
        
        // Update equipment info
        fleetSize: carrierData.fleetSize,
        totalPowerUnits: carrierData.totalPowerUnits,
        
        // Update insurance details
        autoLiabilityExpiration: carrierData.autoLiabilityExpiration || carrier.autoLiabilityExpiration,
        autoLiabilityCoverage: carrierData.autoLiabilityCoverage || carrier.autoLiabilityCoverage,
        generalLiabilityExpiration: carrierData.generalLiabilityExpiration || carrier.generalLiabilityExpiration,
        generalLiabilityCoverage: carrierData.generalLiabilityCoverage || carrier.generalLiabilityCoverage,
        cargoLiabilityExpiration: carrierData.cargoLiabilityExpiration || carrier.cargoLiabilityExpiration,
        cargoLiabilityCoverage: carrierData.cargoLiabilityCoverage || carrier.cargoLiabilityCoverage
      };
      
      await prisma.carrier.update({
        where: { id: carrier.id },
        data: updateData
      });
      
      console.log('✅ Database updated successfully');
      
      // Show the changes
      console.log('\n6. Changes Applied:');
      console.log('-------------------');
      if (carrier.mcpPacketStatus !== updateData.mcpPacketStatus) {
        console.log(`  Packet Status: "${carrier.mcpPacketStatus}" → "${updateData.mcpPacketStatus}"`);
      }
      if (carrier.mcpPacketCompleted !== updateData.mcpPacketCompleted) {
        console.log(`  Packet Completed: ${carrier.mcpPacketCompleted} → ${updateData.mcpPacketCompleted}`);
      }
      if (!carrier.mcpPacketCompletedAt && updateData.mcpPacketCompletedAt) {
        console.log(`  Packet Completed At: Never → ${updateData.mcpPacketCompletedAt}`);
      }
      if (carrier.mcpAuthorityStatus !== updateData.mcpAuthorityStatus) {
        console.log(`  Authority Status: "${carrier.mcpAuthorityStatus}" → "${updateData.mcpAuthorityStatus}"`);
      }
      
      // Try to download documents if packet is completed
      if (updateData.mcpPacketCompleted && carrierData._rawMcpData) {
        console.log('\n7. Checking for documents...');
        try {
          const docResults = await mcpService.downloadCarrierDocuments(carrier.id, carrierData._rawMcpData);
          console.log(`✅ Downloaded ${docResults.downloaded} documents`);
          if (docResults.failed > 0) {
            console.log(`⚠️  Failed to download ${docResults.failed} documents`);
          }
        } catch (docError) {
          console.log('⚠️  Could not download documents:', docError.message);
        }
      }
      
      console.log('\n✅ Sync completed successfully!');
      
    } catch (mcpError) {
      console.error('\n❌ Error fetching MCP data:', mcpError.message);
      
      // Fall back to local sync
      console.log('\n Falling back to local sync...');
      const correctStatus = carrier.mcpPacketCompleted ? 'Completed' : 'Not Completed';
      
      if (carrier.mcpPacketStatus !== correctStatus) {
        await prisma.carrier.update({
          where: { id: carrier.id },
          data: { 
            mcpPacketStatus: correctStatus,
            mcpLastSync: new Date()
          }
        });
        console.log(`✅ Updated packet status to: ${correctStatus}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixOlrSync().catch(console.error);