require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the compiled service
const { MyCarrierPacketsService } = require('../dist/services/mycarrierpackets.service');
const { isMCPConfigured } = require('../dist/config/mcp.config');

async function debugOLRSync() {
  try {
    console.log('=== Debug OLR MCP Sync ===\n');
    
    if (!isMCPConfigured()) {
      console.error('MCP is not configured');
      return;
    }
    
    const mcpService = new MyCarrierPacketsService();
    
    // First check monitored carriers
    console.log('1. Checking if OLR is in monitored carriers list...');
    const { carriers: monitoredCarriers } = await mcpService.getMonitoredCarriers(1, 2500);
    
    const olrMonitored = monitoredCarriers.find(c => 
      c.dotNumber === '1790872' || 
      c.DOTNumber === '1790872' ||
      c.dotNumber?.Value === '1790872' ||
      c.Identity?.usDOT === '1790872'
    );
    
    if (olrMonitored) {
      console.log('✅ Found in monitored carriers');
      console.log('Monitored data structure:');
      console.log('  - Name:', olrMonitored.Identity?.legalName || olrMonitored.Identity?.name);
      console.log('  - DOT:', olrMonitored.Identity?.usDOT || olrMonitored.dotNumber);
      console.log('  - Safety object:', JSON.stringify(olrMonitored.Safety, null, 2));
      console.log('  - Risk Assessment:', JSON.stringify(olrMonitored.RiskAssessment, null, 2));
      console.log('  - Risk Assessment Details:', JSON.stringify(olrMonitored.RiskAssessmentDetails, null, 2));
    } else {
      console.log('❌ Not found in monitored carriers');
    }
    
    // Now get carrier data directly
    console.log('\n2. Fetching carrier data via GetCarrierData endpoint...');
    const carrierData = await mcpService.getCarrierData('1790872', 'MC652116');
    
    console.log('\nMapped carrier data:');
    console.log('  - Name:', carrierData.name);
    console.log('  - Safety Rating:', carrierData.safetyRating);
    console.log('  - MCP Authority Status:', carrierData.mcpAuthorityStatus);
    console.log('  - MCP Risk Score:', carrierData.mcpRiskScore);
    
    // Check raw data
    if (carrierData._rawMcpData) {
      console.log('\n3. Raw MCP Data Analysis:');
      const raw = carrierData._rawMcpData;
      
      console.log('  - Has AssureAdvantage:', !!raw.AssureAdvantage);
      if (raw.AssureAdvantage && raw.AssureAdvantage[0]) {
        console.log('  - AssureAdvantage[0].RiskScore:', raw.AssureAdvantage[0].RiskScore);
        console.log('  - AssureAdvantage[0].CarrierDetails:', !!raw.AssureAdvantage[0].CarrierDetails);
        if (raw.AssureAdvantage[0].CarrierDetails) {
          console.log('  - Safety:', JSON.stringify(raw.AssureAdvantage[0].CarrierDetails.Safety, null, 2));
          console.log('  - RiskAssessment:', JSON.stringify(raw.AssureAdvantage[0].CarrierDetails.RiskAssessment, null, 2));
        }
      }
      
      // Check other possible locations
      console.log('\n  Direct properties:');
      console.log('  - Safety:', JSON.stringify(raw.Safety, null, 2));
      console.log('  - RiskAssessment:', JSON.stringify(raw.RiskAssessment, null, 2));
      console.log('  - CarrierOperationalDetail:', !!raw.CarrierOperationalDetail);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugOLRSync();