#!/usr/bin/env node

/**
 * Quick test to check OLR Transportation MCP sync status
 * DOT Number: 1790872
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickTest() {
  try {
    console.log('Checking OLR Transportation (DOT: 1790872)...\n');
    
    const carrier = await prisma.carrier.findFirst({
      where: { dotNumber: '1790872' }
    });
    
    if (!carrier) {
      console.log('❌ Carrier not found!');
      return;
    }
    
    console.log('Database Status:');
    console.log('----------------');
    console.log(`Name: ${carrier.name}`);
    console.log(`MCP Packet Status: ${carrier.mcpPacketStatus || 'Not Set'}`);
    console.log(`MCP Packet Completed: ${carrier.mcpPacketCompleted}`);
    console.log(`MCP Packet Completed At: ${carrier.mcpPacketCompletedAt || 'Never'}`);
    console.log(`MCP Last Sync: ${carrier.mcpLastSync || 'Never'}`);
    
    // Quick analysis
    console.log('\nAnalysis:');
    console.log('---------');
    
    if (carrier.mcpPacketStatus === 'Completed' && carrier.mcpPacketCompleted) {
      console.log('✅ Packet shows as completed in database');
    } else if (carrier.mcpPacketStatus === 'Not Completed' && !carrier.mcpPacketCompleted) {
      console.log('⚠️  Packet shows as NOT completed in database');
    } else {
      console.log('❌ Inconsistent packet status!');
      console.log(`   - mcpPacketStatus: ${carrier.mcpPacketStatus}`);
      console.log(`   - mcpPacketCompleted: ${carrier.mcpPacketCompleted}`);
    }
    
    if (carrier.mcpLastSync) {
      const hoursSinceSync = (Date.now() - new Date(carrier.mcpLastSync).getTime()) / (1000 * 60 * 60);
      console.log(`\nLast synced: ${hoursSinceSync.toFixed(1)} hours ago`);
      
      if (hoursSinceSync > 24) {
        console.log('⚠️  Sync is more than 24 hours old - may need update');
      }
    } else {
      console.log('\n⚠️  Never synced with MCP');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickTest();