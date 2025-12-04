#!/usr/bin/env node

/**
 * Script to fetch monitored carriers data from MCP and check OLR Transportation fields
 * DOT Number: 1790872
 */

const { mcpService } = require('../dist/services/mycarrierpackets.service');
const fs = require('fs').promises;
const path = require('path');

const OLR_DOT_NUMBER = '1790872';

// Helper function to display GetCarrierData format
function displayCarrierData(source, data) {
  console.log(`=== ${source} Fields ===\n`);
  
  console.log('Basic Information:');
  console.log(`- DOT Number: ${data.DOTNumber || 'N/A'}`);
  console.log(`- MC Number: ${data.MCNumber || 'N/A'}`);
  console.log(`- Legal Name: ${data.LegalName || 'N/A'}`);
  console.log(`- DBA Name: ${data.DBAName || 'N/A'}`);
  console.log(`- SCAC: ${data.SCAC || 'N/A'}\n`);
  
  console.log('Contact Information:');
  console.log(`- Phone: ${data.Phone || 'N/A'}`);
  console.log(`- Cell Phone: ${data.CellPhone || 'N/A'}`);
  console.log(`- Email: ${data.Email || 'N/A'}`);
  console.log(`- Emergency Phone: ${data.EmergencyPhone || 'N/A'}\n`);
  
  console.log('Address:');
  console.log(`- Address1: ${data.Address1 || 'N/A'}`);
  console.log(`- Address2: ${data.Address2 || 'N/A'}`);
  console.log(`- City: ${data.City || 'N/A'}`);
  console.log(`- State: ${data.State || 'N/A'}`);
  console.log(`- Zipcode: ${data.Zipcode || 'N/A'}\n`);
  
  console.log('Operational Details:');
  if (data.CarrierOperationalDetail) {
    console.log(`- Fleet Size: ${data.CarrierOperationalDetail.FleetSize || 'N/A'}`);
    console.log(`- Total Power Units: ${data.CarrierOperationalDetail.TotalPowerUnits || 'N/A'}`);
  } else {
    console.log('- No operational details');
  }
  
  console.log('\nAuthority & Safety:');
  console.log(`- Authority Status: ${data.AuthorityStatus || 'N/A'}`);
  if (data.AssureAdvantage?.[0]) {
    console.log(`- Risk Score: ${data.AssureAdvantage[0].RiskScore || 'N/A'}`);
    console.log(`- Safety Rating: ${data.AssureAdvantage[0].CarrierDetails?.Safety?.rating || 'N/A'}`);
    console.log(`- Risk Assessment: ${data.AssureAdvantage[0].CarrierDetails?.RiskAssessment?.Overall || 'N/A'}`);
  }
  
  console.log('\nInsurance Information:');
  if (data.Insurance) {
    console.log(`- Expiration Date: ${data.Insurance.ExpirationDate || 'N/A'}`);
    console.log(`- Blob Name: ${data.Insurance.BlobName || 'N/A'}`);
  } else {
    console.log('- No insurance data');
  }
  
  console.log('\nDocuments:');
  if (data.W9) {
    console.log(`- W9: ${data.W9.BlobName || 'N/A'} (Uploaded: ${data.W9.UploadedDate || 'N/A'})`);
  }
  if (data.OperatingAgreement) {
    console.log(`- Operating Agreement: ${data.OperatingAgreement.BlobName || 'N/A'} (Signed: ${data.OperatingAgreement.SignedDate || 'N/A'})`);
  }
  if (data.Documents && data.Documents.length > 0) {
    console.log(`- Additional Documents: ${data.Documents.length}`);
  }
  
  console.log('\nPacket Status:');
  console.log(`- Packet Complete: ${data.PacketComplete || 'N/A'}`);
  console.log(`- Packet Complete Date: ${data.PacketCompleteDate || 'N/A'}\n`);
  
  console.log('All Top-Level Fields:');
  Object.keys(data).sort().forEach(field => {
    const value = data[field];
    const type = Array.isArray(value) ? 'array' : typeof value;
    console.log(`- ${field}: ${type}`);
  });
}

// Helper function to display MonitoredCarrierData format
function displayMonitoredData(source, data) {
  console.log(`=== ${source} Fields ===\n`);
  
  console.log('Basic Information:');
  console.log(`- DOT Number: ${data.dotNumber?.Value || data.dotNumber || 'N/A'}`);
  console.log(`- Docket Number: ${data.docketNumber || 'N/A'}`);
  
  if (data.Identity) {
    console.log('\nIdentity Information:');
    console.log(`- Legal Name: ${data.Identity.legalName || 'N/A'}`);
    console.log(`- DBA Name: ${data.Identity.dbaName || 'N/A'}`);
    console.log(`- Business Phone: ${data.Identity.businessPhone || 'N/A'}`);
    console.log(`- Cell Phone: ${data.Identity.cellPhone || 'N/A'}`);
    console.log(`- Email: ${data.Identity.emailAddress || 'N/A'}`);
    console.log(`- Business Street: ${data.Identity.businessStreet || 'N/A'}`);
    console.log(`- Business City: ${data.Identity.businessCity || 'N/A'}`);
    console.log(`- Business State: ${data.Identity.businessState || 'N/A'}`);
    console.log(`- Business Zip: ${data.Identity.businessZipCode || 'N/A'}`);
  }
  
  if (data.Equipment) {
    console.log('\nEquipment Information:');
    console.log(`- Total Trucks: ${data.Equipment.trucksTotal || 'N/A'}`);
    console.log(`- Total Power: ${data.Equipment.totalPower || 'N/A'}`);
    console.log(`- Drivers: ${data.Equipment.drivers || 'N/A'}`);
  }
  
  if (data.Authority) {
    console.log('\nAuthority Information:');
    console.log(`- Common Authority: ${data.Authority.commonAuthority || 'N/A'}`);
    console.log(`- Contract Authority: ${data.Authority.contractAuthority || 'N/A'}`);
  }
  
  if (data.Safety) {
    console.log('\nSafety Information:');
    console.log(`- Safety Rating: ${data.Safety.rating || 'N/A'}`);
    console.log(`- Review Date: ${data.Safety.reviewDate || 'N/A'}`);
  }
  
  if (data.RiskAssessmentDetails) {
    console.log('\nRisk Assessment:');
    console.log(`- Total Points: ${data.RiskAssessmentDetails.TotalPoints || 'N/A'}`);
    console.log(`- Risk Level: ${data.RiskAssessmentDetails.RiskLevel || 'N/A'}`);
  }
  
  if (data.CertData?.Certificate?.[0]) {
    console.log('\nInsurance Certificate Data:');
    const cert = data.CertData.Certificate[0];
    console.log(`- Certificate Holder: ${cert.CertificateHolder || 'N/A'}`);
    console.log(`- Producer: ${cert.Producer?.Name || 'N/A'}`);
    console.log(`- Insured: ${cert.Insured || 'N/A'}`);
    console.log(`- Blob Name: ${cert.BlobName || 'N/A'}`);
    
    if (cert.Coverage && cert.Coverage.length > 0) {
      console.log('\nCoverage Details:');
      cert.Coverage.forEach((coverage, index) => {
        console.log(`  Coverage ${index + 1}:`);
        console.log(`  - Type: ${coverage.type || 'N/A'}`);
        console.log(`  - Policy Number: ${coverage.policyNumber || 'N/A'}`);
        console.log(`  - Effective Date: ${coverage.effectiveDate || 'N/A'}`);
        console.log(`  - Expiration Date: ${coverage.expirationDate || 'N/A'}`);
        console.log(`  - Limit: ${coverage.limit || 'N/A'}`);
        console.log(`  - Deductible: ${coverage.deductible || 'N/A'}`);
      });
    }
  }
  
  console.log('\nAll Top-Level Fields:');
  Object.keys(data).sort().forEach(field => {
    const value = data[field];
    const type = Array.isArray(value) ? 'array' : typeof value;
    console.log(`- ${field}: ${type}`);
  });
}

async function fetchAndCheckOLR() {
  try {
    console.log('=== Checking OLR Transportation (DOT: 1790872) ===\n');
    
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    // 1. Try GetCarrierData endpoint
    console.log('1. Fetching from GetCarrierData endpoint...\n');
    
    let getCarrierDataResponse = null;
    try {
      const carrierData = await mcpService.getCarrierData(OLR_DOT_NUMBER);
      
      if (carrierData) {
        console.log('✅ Found OLR in GetCarrierData!\n');
        
        // Save raw data
        getCarrierDataResponse = carrierData._rawMcpData || carrierData;
        const carrierDataPath = path.join(outputDir, 'olr-getcarrier-data.json');
        await fs.writeFile(carrierDataPath, JSON.stringify(getCarrierDataResponse, null, 2));
        console.log(`GetCarrierData response saved to: ${carrierDataPath}\n`);
        
        // Display data
        displayCarrierData('GetCarrierData', getCarrierDataResponse);
      }
    } catch (error) {
      console.error('Error fetching from GetCarrierData:', error.message, '\n');
    }
    
    // 2. Try MonitoredCarrierData endpoint
    console.log('\n2. Fetching from MonitoredCarrierData endpoint...\n');
    
    let monitoredCarrierDataResponse = null;
    let pageNumber = 1;
    let foundInMonitored = false;
    
    while (!foundInMonitored && pageNumber <= 10) { // Limit to 10 pages
      console.log(`Fetching page ${pageNumber}...`);
      
      try {
        const { carriers, pagination } = await mcpService.getMonitoredCarrierData(pageNumber, 250);
        
        console.log(`Page ${pageNumber}: ${carriers.length} carriers`);
        console.log(`Total carriers: ${pagination?.totalCount || 'unknown'}\n`);
        
        // Look for OLR in this batch
        for (const carrier of carriers) {
          const dotNumber = carrier.dotNumber?.Value?.toString() || carrier.dotNumber?.toString() || '';
          
          if (dotNumber === OLR_DOT_NUMBER) {
            foundInMonitored = true;
            monitoredCarrierDataResponse = carrier;
            console.log('✅ Found OLR in MonitoredCarrierData!\n');
            
            // Save monitored data
            const monitoredDataPath = path.join(outputDir, 'olr-monitored-carrier-data.json');
            await fs.writeFile(monitoredDataPath, JSON.stringify(monitoredCarrierDataResponse, null, 2));
            console.log(`MonitoredCarrierData response saved to: ${monitoredDataPath}\n`);
            
            displayMonitoredData('MonitoredCarrierData', monitoredCarrierDataResponse);
            break;
          }
        }
        
        // Check if there are more pages
        if (!foundInMonitored && pagination && pagination.hasMore) {
          pageNumber++;
        } else {
          break;
        }
      } catch (error) {
        console.error(`Error fetching MonitoredCarrierData page ${pageNumber}:`, error.message);
        break;
      }
    }
    
    if (!foundInMonitored) {
      console.log('❌ OLR not found in MonitoredCarrierData\n');
    }
    
    // 3. Try MonitoredCarriers endpoint
    console.log('\n3. Fetching from MonitoredCarriers endpoint...\n');
    
    let monitoredCarriersResponse = null;
    pageNumber = 1;
    let foundInMonitoredCarriers = false;
    
    while (!foundInMonitoredCarriers && pageNumber <= 2) { // This endpoint has fewer pages
      console.log(`Fetching page ${pageNumber}...`);
      
      try {
        const { carriers, pagination } = await mcpService.getMonitoredCarriers(pageNumber, 500);
        
        console.log(`Page ${pageNumber}: ${carriers.length} carriers`);
        console.log(`Total carriers: ${pagination?.totalCount || 'unknown'}\n`);
        
        // Look for OLR in this batch
        for (const carrier of carriers) {
          const dotNumber = carrier.dotNumber?.Value?.toString() || carrier.dotNumber?.toString() || carrier.DOTNumber?.toString() || '';
          
          if (dotNumber === OLR_DOT_NUMBER) {
            foundInMonitoredCarriers = true;
            monitoredCarriersResponse = carrier;
            console.log('✅ Found OLR in MonitoredCarriers!\n');
            
            // Save data
            const monitoredCarriersPath = path.join(outputDir, 'olr-monitored-carriers.json');
            await fs.writeFile(monitoredCarriersPath, JSON.stringify(monitoredCarriersResponse, null, 2));
            console.log(`MonitoredCarriers response saved to: ${monitoredCarriersPath}\n`);
            break;
          }
        }
        
        // Check if there are more pages
        if (!foundInMonitoredCarriers && pagination && (pageNumber < (pagination.totalPages || 2))) {
          pageNumber++;
        } else {
          break;
        }
      } catch (error) {
        console.error(`Error fetching MonitoredCarriers page ${pageNumber}:`, error.message);
        break;
      }
    }
    
    if (!foundInMonitoredCarriers) {
      console.log('❌ OLR not found in MonitoredCarriers\n');
    }
    
    // Compare results
    console.log('\n=== COMPARISON SUMMARY ===\n');
    
    if (getCarrierDataResponse && monitoredCarrierDataResponse) {
      console.log('Comparing GetCarrierData vs MonitoredCarrierData:\n');
      
      // Check insurance data
      console.log('Insurance Data:');
      console.log('- GetCarrierData has Insurance field:', !!getCarrierDataResponse.Insurance);
      console.log('- MonitoredCarrierData has CertData:', !!monitoredCarrierDataResponse.CertData);
      
      if (monitoredCarrierDataResponse.CertData?.Certificate?.[0]?.Coverage) {
        console.log('- MonitoredCarrierData has detailed coverage info: Yes');
        console.log(`- Number of coverage types: ${monitoredCarrierDataResponse.CertData.Certificate[0].Coverage.length}`);
      } else {
        console.log('- MonitoredCarrierData has detailed coverage info: No');
      }
      
      console.log('\nPacket Status:');
      console.log(`- GetCarrierData PacketComplete: ${getCarrierDataResponse.PacketComplete}`);
      console.log(`- MonitoredCarrierData has packet info: ${!!monitoredCarrierDataResponse.PacketComplete || !!monitoredCarrierDataResponse.PacketStatus}`);
      
      console.log('\nUnique fields in MonitoredCarrierData:');
      const monitoredFields = new Set(Object.keys(monitoredCarrierDataResponse));
      const getCarrierFields = new Set(Object.keys(getCarrierDataResponse));
      const uniqueToMonitored = [...monitoredFields].filter(field => !getCarrierFields.has(field));
      
      if (uniqueToMonitored.length > 0) {
        uniqueToMonitored.forEach(field => console.log(`  - ${field}`));
      } else {
        console.log('  - None');
      }
    }
    
    // Final recommendation
    console.log('\n=== RECOMMENDATION ===\n');
    if (monitoredCarrierDataResponse?.CertData?.Certificate?.[0]?.Coverage) {
      console.log('✅ MonitoredCarrierData endpoint provides more complete insurance data');
      console.log('   - Has detailed coverage information (Auto, General, Cargo)');
      console.log('   - Includes policy numbers, limits, and expiration dates');
      console.log('   - Better for getting comprehensive insurance details');
    } else if (getCarrierDataResponse) {
      console.log('⚠️  GetCarrierData endpoint provides basic data');
      console.log('   - Has general insurance expiration');
      console.log('   - Has packet completion status');
      console.log('   - May be sufficient for basic monitoring');
    } else {
      console.log('❌ OLR Transportation needs to be added to monitoring first');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
fetchAndCheckOLR()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });