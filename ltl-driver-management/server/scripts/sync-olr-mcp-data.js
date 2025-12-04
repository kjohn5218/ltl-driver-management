const { PrismaClient } = require('@prisma/client');
const { MyCarrierPacketsService } = require('../dist/services/mycarrierpackets.service');

const prisma = new PrismaClient();

async function syncOLRTransportation() {
  try {
    console.log('=== Syncing OLR Transportation MCP Data ===\n');
    
    // Find OLR Transportation in the database
    const olr = await prisma.carrier.findFirst({
      where: {
        OR: [
          { name: { contains: 'OLR Transportation' } },
          { name: { contains: 'OLR TRANSPORTATION' } },
          { dbaName: { contains: 'OLR Transportation' } }
        ]
      }
    });

    if (!olr) {
      console.error('❌ OLR Transportation not found in the database');
      return;
    }

    console.log('✅ Found OLR Transportation in database:');
    console.log(`   ID: ${olr.id}`);
    console.log(`   Name: ${olr.name}`);
    console.log(`   DOT: ${olr.dotNumber || 'Not set'}`);
    console.log(`   MC: ${olr.mcNumber || 'Not set'}`);

    if (!olr.dotNumber) {
      console.error('\n❌ OLR Transportation does not have a DOT number in the database');
      return;
    }

    // Show current MCP fields before sync
    console.log('\n📋 Current MCP Data:');
    console.log(`   Safety Rating: ${olr.mcpSafetyRating || 'Not set'}`);
    console.log(`   Authority Status: ${olr.mcpAuthorityStatus || 'Not set'}`);
    console.log(`   Risk Score: ${olr.mcpRiskScore || 'Not set'}`);
    console.log(`   Insurance Expiration: ${olr.mcpInsuranceExpiration ? olr.mcpInsuranceExpiration.toLocaleDateString() : 'Not set'}`);
    console.log(`   Packet Completed: ${olr.mcpPacketCompleted ? 'Yes' : 'No'}`);
    console.log(`   Packet Status: ${olr.mcpPacketStatus || 'Not set'}`);
    console.log(`   Last Sync: ${olr.mcpLastSync ? olr.mcpLastSync.toLocaleString() : 'Never'}`);
    
    // Show insurance coverage details
    console.log('\n💼 Current Insurance Coverage:');
    console.log(`   Auto Liability: ${olr.autoLiabilityCoverage ? `$${olr.autoLiabilityCoverage.toLocaleString()}` : 'Not set'} (Exp: ${olr.autoLiabilityExpiration ? olr.autoLiabilityExpiration.toLocaleDateString() : 'Not set'})`);
    console.log(`   General Liability: ${olr.generalLiabilityCoverage ? `$${olr.generalLiabilityCoverage.toLocaleString()}` : 'Not set'} (Exp: ${olr.generalLiabilityExpiration ? olr.generalLiabilityExpiration.toLocaleDateString() : 'Not set'})`);
    console.log(`   Cargo Liability: ${olr.cargoLiabilityCoverage ? `$${olr.cargoLiabilityCoverage.toLocaleString()}` : 'Not set'} (Exp: ${olr.cargoLiabilityExpiration ? olr.cargoLiabilityExpiration.toLocaleDateString() : 'Not set'})`);

    // Initialize MCP service
    console.log('\n🔄 Connecting to MyCarrierPackets API...');
    const mcpService = new MyCarrierPacketsService();
    
    try {
      // Authenticate first
      await mcpService.authenticate();
      console.log('✅ MCP authentication successful');

      // Fetch carrier data from MCP
      console.log(`\n📥 Fetching carrier data for DOT: ${olr.dotNumber}, MC: ${olr.mcNumber || 'N/A'}`);
      const mcpData = await mcpService.getCarrierData(olr.dotNumber, olr.mcNumber);
      
      console.log('\n✅ Successfully retrieved MCP data');
      
      // Show raw MCP response for debugging
      if (mcpData._rawMcpData) {
        console.log('\n🔍 Raw MCP Response Summary:');
        const raw = mcpData._rawMcpData;
        console.log(`   Legal Name: ${raw.LegalName || 'Not provided'}`);
        console.log(`   DBA Name: ${raw.DBAName || 'Not provided'}`);
        console.log(`   Authority Status: ${raw.AuthorityStatus || 'Not provided'}`);
        console.log(`   Packet Complete: ${raw.PacketComplete || false}`);
        console.log(`   Packet Complete Date: ${raw.PacketCompleteDate || 'Not provided'}`);
        
        if (raw.AssureAdvantage && raw.AssureAdvantage[0]) {
          const assure = raw.AssureAdvantage[0];
          console.log(`   Risk Score: ${assure.RiskScore || 'Not provided'}`);
          if (assure.CarrierDetails) {
            console.log(`   Safety Rating: ${assure.CarrierDetails.Safety?.rating || 'Not provided'}`);
            console.log(`   Risk Assessment Overall: ${assure.CarrierDetails.RiskAssessment?.Overall || 'Not provided'}`);
          }
        }
      }

      // Update carrier with MCP data
      console.log('\n💾 Updating carrier record with MCP data...');
      
      const updateData = {
        // Basic info
        name: mcpData.name || olr.name,
        dbaName: mcpData.dbaName || olr.dbaName,
        scacCode: mcpData.scacCode || olr.scacCode,
        
        // Address
        streetAddress1: mcpData.streetAddress1 || olr.streetAddress1,
        streetAddress2: mcpData.streetAddress2 || olr.streetAddress2,
        city: mcpData.city || olr.city,
        state: mcpData.state || olr.state,
        zipCode: mcpData.zipCode || olr.zipCode,
        
        // Contact
        phone: mcpData.phone || olr.phone,
        email: mcpData.email || olr.email,
        emergencyPhone: mcpData.emergencyPhone || olr.emergencyPhone,
        
        // Equipment
        fleetSize: mcpData.fleetSize || olr.fleetSize,
        totalPowerUnits: mcpData.totalPowerUnits || olr.totalPowerUnits,
        
        // MCP specific fields
        mcpSafetyRating: mcpData.safetyRating || olr.mcpSafetyRating,
        safetyRating: mcpData.safetyRating || olr.safetyRating, // Update the general safety rating too
        mcpAuthorityStatus: mcpData.mcpAuthorityStatus || olr.mcpAuthorityStatus,
        mcpRiskScore: mcpData.mcpRiskScore !== null ? mcpData.mcpRiskScore : olr.mcpRiskScore,
        mcpInsuranceExpiration: mcpData.mcpInsuranceExpiration || olr.mcpInsuranceExpiration,
        mcpPacketCompleted: mcpData.mcpPacketCompleted,
        mcpPacketCompletedAt: mcpData.mcpPacketCompletedAt || olr.mcpPacketCompletedAt,
        mcpPacketStatus: mcpData.mcpPacketStatus || olr.mcpPacketStatus,
        mcpLastSync: new Date(),
        
        // Insurance coverage details
        autoLiabilityExpiration: mcpData.autoLiabilityExpiration || olr.autoLiabilityExpiration,
        autoLiabilityCoverage: mcpData.autoLiabilityCoverage || olr.autoLiabilityCoverage,
        generalLiabilityExpiration: mcpData.generalLiabilityExpiration || olr.generalLiabilityExpiration,
        generalLiabilityCoverage: mcpData.generalLiabilityCoverage || olr.generalLiabilityCoverage,
        cargoLiabilityExpiration: mcpData.cargoLiabilityExpiration || olr.cargoLiabilityExpiration,
        cargoLiabilityCoverage: mcpData.cargoLiabilityCoverage || olr.cargoLiabilityCoverage
      };
      
      const updatedOlr = await prisma.carrier.update({
        where: { id: olr.id },
        data: updateData
      });
      
      console.log('✅ Carrier record updated successfully');
      
      // Show updated MCP fields
      console.log('\n📋 Updated MCP Data:');
      console.log(`   Safety Rating: ${updatedOlr.mcpSafetyRating || 'Not set'} ${olr.mcpSafetyRating !== updatedOlr.mcpSafetyRating ? '✅ UPDATED' : ''}`);
      console.log(`   Authority Status: ${updatedOlr.mcpAuthorityStatus || 'Not set'} ${olr.mcpAuthorityStatus !== updatedOlr.mcpAuthorityStatus ? '✅ UPDATED' : ''}`);
      console.log(`   Risk Score: ${updatedOlr.mcpRiskScore || 'Not set'} ${olr.mcpRiskScore !== updatedOlr.mcpRiskScore ? '✅ UPDATED' : ''}`);
      console.log(`   Insurance Expiration: ${updatedOlr.mcpInsuranceExpiration ? updatedOlr.mcpInsuranceExpiration.toLocaleDateString() : 'Not set'} ${olr.mcpInsuranceExpiration?.getTime() !== updatedOlr.mcpInsuranceExpiration?.getTime() ? '✅ UPDATED' : ''}`);
      console.log(`   Packet Completed: ${updatedOlr.mcpPacketCompleted ? 'Yes' : 'No'} ${olr.mcpPacketCompleted !== updatedOlr.mcpPacketCompleted ? '✅ UPDATED' : ''}`);
      console.log(`   Packet Status: ${updatedOlr.mcpPacketStatus || 'Not set'} ${olr.mcpPacketStatus !== updatedOlr.mcpPacketStatus ? '✅ UPDATED' : ''}`);
      console.log(`   Last Sync: ${updatedOlr.mcpLastSync ? updatedOlr.mcpLastSync.toLocaleString() : 'Never'}`);
      
      // Show updated insurance coverage
      console.log('\n💼 Updated Insurance Coverage:');
      console.log(`   Auto Liability: ${updatedOlr.autoLiabilityCoverage ? `$${updatedOlr.autoLiabilityCoverage.toLocaleString()}` : 'Not set'} (Exp: ${updatedOlr.autoLiabilityExpiration ? updatedOlr.autoLiabilityExpiration.toLocaleDateString() : 'Not set'}) ${olr.autoLiabilityCoverage !== updatedOlr.autoLiabilityCoverage || olr.autoLiabilityExpiration?.getTime() !== updatedOlr.autoLiabilityExpiration?.getTime() ? '✅ UPDATED' : ''}`);
      console.log(`   General Liability: ${updatedOlr.generalLiabilityCoverage ? `$${updatedOlr.generalLiabilityCoverage.toLocaleString()}` : 'Not set'} (Exp: ${updatedOlr.generalLiabilityExpiration ? updatedOlr.generalLiabilityExpiration.toLocaleDateString() : 'Not set'}) ${olr.generalLiabilityCoverage !== updatedOlr.generalLiabilityCoverage || olr.generalLiabilityExpiration?.getTime() !== updatedOlr.generalLiabilityExpiration?.getTime() ? '✅ UPDATED' : ''}`);
      console.log(`   Cargo Liability: ${updatedOlr.cargoLiabilityCoverage ? `$${updatedOlr.cargoLiabilityCoverage.toLocaleString()}` : 'Not set'} (Exp: ${updatedOlr.cargoLiabilityExpiration ? updatedOlr.cargoLiabilityExpiration.toLocaleDateString() : 'Not set'}) ${olr.cargoLiabilityCoverage !== updatedOlr.cargoLiabilityCoverage || olr.cargoLiabilityExpiration?.getTime() !== updatedOlr.cargoLiabilityExpiration?.getTime() ? '✅ UPDATED' : ''}`);
      
      // Try to download documents if available
      if (mcpData._rawMcpData && (mcpData._rawMcpData.Insurance || mcpData._rawMcpData.Documents)) {
        console.log('\n📄 Checking for available documents...');
        try {
          const docResults = await mcpService.downloadCarrierDocuments(olr.id, mcpData._rawMcpData);
          console.log(`✅ Downloaded ${docResults.downloaded} documents, ${docResults.failed} failed`);
          
          if (docResults.documents.length > 0) {
            console.log('\nDocument Details:');
            docResults.documents.forEach(doc => {
              console.log(`   - ${doc.type}: ${doc.fileName} (${doc.status})`);
              if (doc.error) {
                console.log(`     Error: ${doc.error}`);
              }
            });
          }
        } catch (docError) {
          console.error('❌ Failed to download documents:', docError.message);
        }
      }
      
      // Summary
      console.log('\n✅ Sync completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   Carrier: ${updatedOlr.name}`);
      console.log(`   DOT Number: ${updatedOlr.dotNumber}`);
      console.log(`   MC Number: ${updatedOlr.mcNumber || 'N/A'}`);
      console.log(`   MCP Safety Rating: ${updatedOlr.mcpSafetyRating || 'Not set'}`);
      console.log(`   MCP Packet Status: ${updatedOlr.mcpPacketStatus || 'Not set'}`);
      
    } catch (mcpError) {
      console.error('\n❌ MCP API Error:', mcpError.message);
      if (mcpError.details) {
        console.error('Error Details:', JSON.stringify(mcpError.details, null, 2));
      }
      if (mcpError.statusCode) {
        console.error('Status Code:', mcpError.statusCode);
      }
    }
    
  } catch (error) {
    console.error('❌ Error syncing OLR Transportation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncOLRTransportation();