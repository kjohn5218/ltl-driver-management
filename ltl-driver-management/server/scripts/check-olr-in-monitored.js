require('dotenv').config();
const { MyCarrierPacketsService } = require('../dist/services/mycarrierpackets.service');
const { isMCPConfigured } = require('../dist/config/mcp.config');

async function checkOLRInMonitored() {
  if (!isMCPConfigured()) {
    console.error('MCP is not configured');
    process.exit(1);
  }

  try {
    console.log('Checking OLR in monitored carriers...\n');
    
    const mcpService = new MyCarrierPacketsService();
    const { carriers } = await mcpService.getMonitoredCarriers(1, 2500);
    
    console.log(`Total monitored carriers: ${carriers.length}\n`);
    
    // Look for OLR in various ways
    const olrVariations = carriers.filter(c => {
      const name = c.name || c.Identity?.legalName || '';
      const dot = c.dotNumber || c.DOTNumber || c.Identity?.usDOT || '';
      
      return name.includes('OLR') || 
             dot === '1790872' ||
             name.includes('OLD LEGION');
    });
    
    if (olrVariations.length > 0) {
      console.log(`Found ${olrVariations.length} possible OLR matches:\n`);
      
      olrVariations.forEach((carrier, index) => {
        console.log(`Match ${index + 1}:`);
        console.log('  Name:', carrier.name || carrier.Identity?.legalName);
        console.log('  DOT:', carrier.dotNumber || carrier.DOTNumber || carrier.Identity?.usDOT);
        console.log('  MC:', carrier.mcNumber || carrier.docketNumber);
        console.log('  Safety Rating:', carrier.safetyRating);
        console.log('  Raw carrier object keys:', Object.keys(carrier).join(', '));
        console.log('');
      });
    } else {
      console.log('OLR Transportation not found in monitored carriers');
      
      // Check if it's in the raw response with different structure
      const rawOLR = carriers.find(c => 
        JSON.stringify(c).includes('1790872') || 
        JSON.stringify(c).includes('OLR TRANSPORTATION')
      );
      
      if (rawOLR) {
        console.log('\nFound OLR in raw data:');
        console.log(JSON.stringify(rawOLR, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOLRInMonitored();