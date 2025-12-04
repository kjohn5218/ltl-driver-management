#!/usr/bin/env node

/**
 * Test script to diagnose MCP sync issues for OLR Transportation
 * DOT Number: 1790872
 * 
 * This script:
 * 1. Connects to the database and finds the carrier
 * 2. Shows all MCP-related fields
 * 3. Calls the MCP service to get fresh data
 * 4. Compares database vs MCP data
 * 5. Shows differences
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the MCP service
const { MyCarrierPacketsService } = require('../dist/services/mycarrierpackets.service');
const { getMCPConfig, isMCPConfigured } = require('../dist/config/mcp.config');

const DOT_NUMBER = '1790872';
const CARRIER_NAME = 'OLR Transportation';

async function main() {
  console.log('========================================');
  console.log('MCP Sync Test for OLR Transportation');
  console.log('DOT Number:', DOT_NUMBER);
  console.log('========================================\n');

  try {
    // Step 1: Find carrier in database
    console.log('1. Finding carrier in database...');
    const carrier = await prisma.carrier.findFirst({
      where: { dotNumber: DOT_NUMBER },
      include: {
        documents: {
          where: {
            documentType: {
              in: ['MCP_INSURANCE', 'MCP_W9', 'MCP_OPERATING_AGREEMENT']
            }
          }
        }
      }
    });

    if (!carrier) {
      console.error(`❌ Carrier with DOT ${DOT_NUMBER} not found in database!`);
      process.exit(1);
    }

    console.log('✅ Carrier found in database\n');
    console.log('2. Current Database Values:');
    console.log('---------------------------');
    console.log('Basic Info:');
    console.log(`  ID: ${carrier.id}`);
    console.log(`  Name: ${carrier.name}`);
    console.log(`  DBA Name: ${carrier.dbaName || 'N/A'}`);
    console.log(`  MC Number: ${carrier.mcNumber || 'N/A'}`);
    console.log(`  SCAC Code: ${carrier.scacCode || 'N/A'}`);
    console.log();
    console.log('MCP Fields:');
    console.log(`  MCP Monitored: ${carrier.mcpMonitored}`);
    console.log(`  MCP Packet Completed: ${carrier.mcpPacketCompleted}`);
    console.log(`  MCP Packet Completed At: ${carrier.mcpPacketCompletedAt || 'N/A'}`);
    console.log(`  MCP Packet Status: ${carrier.mcpPacketStatus || 'N/A'}`);
    console.log(`  MCP Authority Status: ${carrier.mcpAuthorityStatus || 'N/A'}`);
    console.log(`  MCP Safety Rating: ${carrier.mcpSafetyRating || 'N/A'}`);
    console.log(`  MCP Risk Score: ${carrier.mcpRiskScore || 'N/A'}`);
    console.log(`  MCP Total Points: ${carrier.mcpTotalPoints || 'N/A'}`);
    console.log(`  MCP Last Sync: ${carrier.mcpLastSync || 'Never'}`);
    console.log();
    console.log('Insurance Information:');
    console.log(`  MCP Insurance Expiration: ${carrier.mcpInsuranceExpiration || 'N/A'}`);
    console.log(`  Auto Liability Expiration: ${carrier.autoLiabilityExpiration || 'N/A'}`);
    console.log(`  Auto Liability Coverage: ${carrier.autoLiabilityCoverage || 'N/A'}`);
    console.log(`  General Liability Expiration: ${carrier.generalLiabilityExpiration || 'N/A'}`);
    console.log(`  General Liability Coverage: ${carrier.generalLiabilityCoverage || 'N/A'}`);
    console.log(`  Cargo Liability Expiration: ${carrier.cargoLiabilityExpiration || 'N/A'}`);
    console.log(`  Cargo Liability Coverage: ${carrier.cargoLiabilityCoverage || 'N/A'}`);
    console.log();
    console.log('Documents:');
    if (carrier.documents.length > 0) {
      carrier.documents.forEach(doc => {
        console.log(`  - ${doc.documentType}: ${doc.filename} (uploaded ${doc.uploadedAt})`);
      });
    } else {
      console.log('  No MCP documents found');
    }

    // Check if MCP is configured
    if (!isMCPConfigured()) {
      console.log('\n⚠️  MCP is not configured - cannot fetch live data');
      console.log('Please set MCP environment variables to test live sync');
      process.exit(0);
    }

    // Step 3: Get fresh data from MCP
    console.log('\n\n3. Fetching fresh data from MCP...');
    console.log('----------------------------------');
    
    const mcpService = new MyCarrierPacketsService();
    
    try {
      // First, check if carrier is in monitored list
      console.log('Checking monitored carriers list...');
      const { carriers: monitoredCarriers } = await mcpService.getMonitoredCarriers(1, 2500);
      const isMonitored = monitoredCarriers.some(c => 
        c.DOTNumber?.toString() === DOT_NUMBER || 
        c.dotNumber?.Value?.toString() === DOT_NUMBER ||
        c.dotNumber?.toString() === DOT_NUMBER
      );
      console.log(`Carrier is ${isMonitored ? '✅' : '❌'} in monitored carriers list`);

      // Try to get carrier data directly
      console.log('\nFetching carrier data from GetCarrierData endpoint...');
      const carrierData = await mcpService.getCarrierData(DOT_NUMBER, carrier.mcNumber);
      
      console.log('\n✅ MCP Data Retrieved Successfully\n');
      console.log('4. MCP Fresh Data:');
      console.log('------------------');
      console.log('Basic Info:');
      console.log(`  Name: ${carrierData.name}`);
      console.log(`  DBA Name: ${carrierData.dbaName || 'N/A'}`);
      console.log(`  DOT Number: ${carrierData.dotNumber}`);
      console.log(`  MC Number: ${carrierData.mcNumber || 'N/A'}`);
      console.log(`  SCAC Code: ${carrierData.scacCode || 'N/A'}`);
      console.log();
      console.log('MCP Status:');
      console.log(`  Authority Status: ${carrierData.mcpAuthorityStatus || 'N/A'}`);
      console.log(`  Safety Rating: ${carrierData.safetyRating || 'N/A'}`);
      console.log(`  Risk Score: ${carrierData.mcpRiskScore || 'N/A'}`);
      console.log(`  Packet Completed: ${carrierData.mcpPacketCompleted}`);
      console.log(`  Packet Completed At: ${carrierData.mcpPacketCompletedAt || 'N/A'}`);
      console.log(`  Packet Status: ${carrierData.mcpPacketStatus || 'N/A'}`);
      console.log();
      console.log('Insurance:');
      console.log(`  Insurance Expiration: ${carrierData.mcpInsuranceExpiration || 'N/A'}`);
      if (carrierData.autoLiabilityExpiration) {
        console.log(`  Auto Liability Expiration: ${carrierData.autoLiabilityExpiration}`);
        console.log(`  Auto Liability Coverage: ${carrierData.autoLiabilityCoverage || 'N/A'}`);
      }
      if (carrierData.generalLiabilityExpiration) {
        console.log(`  General Liability Expiration: ${carrierData.generalLiabilityExpiration}`);
        console.log(`  General Liability Coverage: ${carrierData.generalLiabilityCoverage || 'N/A'}`);
      }
      if (carrierData.cargoLiabilityExpiration) {
        console.log(`  Cargo Liability Expiration: ${carrierData.cargoLiabilityExpiration}`);
        console.log(`  Cargo Liability Coverage: ${carrierData.cargoLiabilityCoverage || 'N/A'}`);
      }
      console.log();
      console.log('Equipment:');
      console.log(`  Fleet Size: ${carrierData.fleetSize}`);
      console.log(`  Total Power Units: ${carrierData.totalPowerUnits}`);

      // Show raw MCP data structure
      if (carrierData._rawMcpData) {
        console.log('\nRaw MCP Data Structure:');
        console.log('  PacketComplete:', carrierData._rawMcpData.PacketComplete);
        console.log('  PacketCompleteDate:', carrierData._rawMcpData.PacketCompleteDate);
        console.log('  AuthorityStatus:', carrierData._rawMcpData.AuthorityStatus);
        console.log('  Insurance:', carrierData._rawMcpData.Insurance);
        console.log('  W9:', carrierData._rawMcpData.W9);
        console.log('  OperatingAgreement:', carrierData._rawMcpData.OperatingAgreement);
        console.log('  Documents:', carrierData._rawMcpData.Documents?.length || 0, 'documents');
      }

      // Step 5: Compare differences
      console.log('\n\n5. Differences Analysis:');
      console.log('------------------------');
      
      const differences = [];
      
      // Compare basic fields
      if (carrier.name !== carrierData.name) {
        differences.push(`Name: DB="${carrier.name}" vs MCP="${carrierData.name}"`);
      }
      if (carrier.dbaName !== carrierData.dbaName) {
        differences.push(`DBA Name: DB="${carrier.dbaName}" vs MCP="${carrierData.dbaName}"`);
      }
      if (carrier.mcNumber !== carrierData.mcNumber) {
        differences.push(`MC Number: DB="${carrier.mcNumber}" vs MCP="${carrierData.mcNumber}"`);
      }
      if (carrier.scacCode !== carrierData.scacCode) {
        differences.push(`SCAC Code: DB="${carrier.scacCode}" vs MCP="${carrierData.scacCode}"`);
      }
      
      // Compare MCP fields
      if (carrier.mcpPacketCompleted !== carrierData.mcpPacketCompleted) {
        differences.push(`MCP Packet Completed: DB="${carrier.mcpPacketCompleted}" vs MCP="${carrierData.mcpPacketCompleted}"`);
      }
      if (carrier.mcpPacketStatus !== carrierData.mcpPacketStatus) {
        differences.push(`MCP Packet Status: DB="${carrier.mcpPacketStatus}" vs MCP="${carrierData.mcpPacketStatus}"`);
      }
      if (carrier.mcpAuthorityStatus !== carrierData.mcpAuthorityStatus) {
        differences.push(`MCP Authority Status: DB="${carrier.mcpAuthorityStatus}" vs MCP="${carrierData.mcpAuthorityStatus}"`);
      }
      if (carrier.mcpSafetyRating !== carrierData.safetyRating) {
        differences.push(`MCP Safety Rating: DB="${carrier.mcpSafetyRating}" vs MCP="${carrierData.safetyRating}"`);
      }
      if (carrier.mcpRiskScore !== carrierData.mcpRiskScore) {
        differences.push(`MCP Risk Score: DB="${carrier.mcpRiskScore}" vs MCP="${carrierData.mcpRiskScore}"`);
      }
      
      // Compare dates (convert to comparable format)
      const dbInsuranceExp = carrier.mcpInsuranceExpiration ? new Date(carrier.mcpInsuranceExpiration).toISOString() : null;
      const mcpInsuranceExp = carrierData.mcpInsuranceExpiration ? new Date(carrierData.mcpInsuranceExpiration).toISOString() : null;
      if (dbInsuranceExp !== mcpInsuranceExp) {
        differences.push(`MCP Insurance Expiration: DB="${dbInsuranceExp}" vs MCP="${mcpInsuranceExp}"`);
      }
      
      // Compare packet completed date
      const dbPacketDate = carrier.mcpPacketCompletedAt ? new Date(carrier.mcpPacketCompletedAt).toISOString() : null;
      const mcpPacketDate = carrierData.mcpPacketCompletedAt ? new Date(carrierData.mcpPacketCompletedAt).toISOString() : null;
      if (dbPacketDate !== mcpPacketDate) {
        differences.push(`MCP Packet Completed At: DB="${dbPacketDate}" vs MCP="${mcpPacketDate}"`);
      }
      
      if (differences.length === 0) {
        console.log('✅ No differences found - database is in sync with MCP');
      } else {
        console.log(`❌ Found ${differences.length} differences:`);
        differences.forEach((diff, index) => {
          console.log(`  ${index + 1}. ${diff}`);
        });
      }

      // Check completed packets endpoint
      console.log('\n\n6. Checking Completed Packets Endpoint:');
      console.log('---------------------------------------');
      
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const today = new Date();
      
      console.log(`Checking packets from ${lastWeek.toISOString()} to ${today.toISOString()}`);
      const { packets: completedPackets } = await mcpService.getCompletedPackets(lastWeek, today);
      
      const olrPacket = completedPackets.find(p => p.dotNumber === DOT_NUMBER);
      if (olrPacket) {
        console.log('✅ Found in completed packets:');
        console.log(`  Carrier Name: ${olrPacket.carrierName}`);
        console.log(`  Completed At: ${olrPacket.completedAt}`);
        console.log(`  Packet Data Available: ${olrPacket.packetData ? 'Yes' : 'No'}`);
      } else {
        console.log('❌ Not found in completed packets for the last week');
      }

      // Suggest fix
      if (differences.length > 0) {
        console.log('\n\n7. Suggested Fix:');
        console.log('-----------------');
        console.log('To sync this carrier, you can run:');
        console.log(`  node scripts/update-packet-status.js ${DOT_NUMBER}`);
        console.log('\nOr to sync all carriers:');
        console.log('  node scripts/sync-packet-status.js');
      }

    } catch (mcpError) {
      console.error('\n❌ Error fetching MCP data:', mcpError.message);
      if (mcpError.statusCode) {
        console.error('Status Code:', mcpError.statusCode);
      }
      if (mcpError.details) {
        console.error('Details:', JSON.stringify(mcpError.details, null, 2));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main().catch(console.error);