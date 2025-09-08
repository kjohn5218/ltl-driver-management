const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Location mapping extracted from the Excel file
const locationMapping = {
  "ALBUQUERQUE": { address: "4200 Ellison St NE", city: "Albuquerque", state: "NM", zipcode: "87109" },
  "ASHTON HILL": { address: "", city: "Ashton Hill", state: "ID", zipcode: "83420" },
  "ALPINE": { address: "2407 Old Marathon Rd", city: "Alpine", state: "TX", zipcode: "79831" },
  "AMARILLO": { address: "715 S Lakeside Dr", city: "Amarillo", state: "TX", zipcode: "79118" },
  "BELFIELD": { address: "804 US-85", city: "Belfield", state: "ND", zipcode: "58622" },
  "BILLINGS": { address: "2660 Gabel Rd", city: "Billings", state: "MT", zipcode: "59102" },
  "BISMARCK": { address: "1841 Hancock Dr", city: "Bismarck", state: "ND", zipcode: "58501" },
  "BOISE": { address: "2840 S Cole Rd", city: "Boise", state: "ID", zipcode: "83709" },
  "BRAMAN": { address: "130 W Braman St", city: "Braman", state: "OK", zipcode: "74632" },
  "BUFFALO": { address: "2801 Ash Ave", city: "Buffalo", state: "WY", zipcode: "82834" },
  "CARPIO": { address: "103 2nd Ave NE", city: "Carpio", state: "ND", zipcode: "58725" },
  "CASPER": { address: "1005 Luker Ln", city: "Casper", state: "WY", zipcode: "82609" },
  "CHEYENNE": { address: "2810 E Lincolnway", city: "Cheyenne", state: "WY", zipcode: "82001" },
  "COLORADO SPRINGS": { address: "2050 Rimrock Dr", city: "Colorado Springs", state: "CO", zipcode: "80915" },
  "CUSHING": { address: "1424 E 6th St", city: "Cushing", state: "OK", zipcode: "74023" },
  "DENVER": { address: "4100 E 45th Ave", city: "Denver", state: "CO", zipcode: "80216" },
  "DICKINSON": { address: "1720 3rd Ave W", city: "Dickinson", state: "ND", zipcode: "58601" },
  "EL PASO": { address: "8889 Boeing Dr", city: "El Paso", state: "TX", zipcode: "79925" },
  "EVANSVILLE": { address: "5650 N 900 W", city: "Evansville", state: "WY", zipcode: "82636" },
  "FARMINGTON": { address: "901 W Apache St", city: "Farmington", state: "NM", zipcode: "87401" },
  "FORT LUPTON": { address: "1405 Denver Ave", city: "Fort Lupton", state: "CO", zipcode: "80621" },
  "FORT WORTH": { address: "1205 Westport Pkwy", city: "Fort Worth", state: "TX", zipcode: "76177" },
  "GILLETTE": { address: "2051 S Douglas Hwy", city: "Gillette", state: "WY", zipcode: "82718" },
  "GLASGOW": { address: "54649 US-2", city: "Glasgow", state: "MT", zipcode: "59230" },
  "GRAND JUNCTION": { address: "2757 Compass Dr", city: "Grand Junction", state: "CO", zipcode: "81506" },
  "GREAT FALLS": { address: "1400 25th St N", city: "Great Falls", state: "MT", zipcode: "59401" },
  "GREELEY": { address: "2707 11th Ave", city: "Greeley", state: "CO", zipcode: "80631" },
  "HAVRE": { address: "1235 1st St W", city: "Havre", state: "MT", zipcode: "59501" },
  "HOUSTON": { address: "14222 Jeanette St", city: "Houston", state: "TX", zipcode: "77040" },
  "JOPLIN": { address: "3128 S Maiden Ln", city: "Joplin", state: "MO", zipcode: "64804" },
  "KANSAS CITY": { address: "1200 E Front St", city: "Kansas City", state: "MO", zipcode: "64120" },
  "LAREDO": { address: "5320 San Dario Ave", city: "Laredo", state: "TX", zipcode: "78041" },
  "LAS VEGAS": { address: "4435 Arville St", city: "Las Vegas", state: "NV", zipcode: "89103" },
  "LUBBOCK": { address: "1902 E 19th St", city: "Lubbock", state: "TX", zipcode: "79403" },
  "MIDLAND": { address: "4400 E Hwy 80", city: "Midland", state: "TX", zipcode: "79706" },
  "MINOT": { address: "905 20th Ave SE", city: "Minot", state: "ND", zipcode: "58701" },
  "MONTANA CITY": { address: "2855 N Montana Ave", city: "Montana City", state: "MT", zipcode: "59634" },
  "OKLAHOMA CITY": { address: "3400 S Council Rd", city: "Oklahoma City", state: "OK", zipcode: "73179" },
  "PHOENIX": { address: "3839 E Van Buren St", city: "Phoenix", state: "AZ", zipcode: "85008" },
  "PUEBLO": { address: "47 Montebello Rd", city: "Pueblo", state: "CO", zipcode: "81001" },
  "RAPID CITY": { address: "1730 N Lacrosse St", city: "Rapid City", state: "SD", zipcode: "57701" },
  "RENO": { address: "1055 E Greg St", city: "Reno", state: "NV", zipcode: "89502" },
  "ROSWELL": { address: "1800 N Richardson Ave", city: "Roswell", state: "NM", zipcode: "88201" },
  "SALT LAKE CITY": { address: "2245 S West Temple", city: "Salt Lake City", state: "UT", zipcode: "84115" },
  "SAN ANTONIO": { address: "8282 Fourwinds Dr", city: "San Antonio", state: "TX", zipcode: "78239" },
  "SANTA FE": { address: "2801 Cerrillos Rd", city: "Santa Fe", state: "NM", zipcode: "87507" },
  "SHERIDAN": { address: "1695 Sugarland Dr", city: "Sheridan", state: "WY", zipcode: "82801" },
  "TIOGA": { address: "302 2nd Ave NE", city: "Tioga", state: "ND", zipcode: "58852" },
  "TUCSON": { address: "6460 S Country Club Rd", city: "Tucson", state: "AZ", zipcode: "85706" },
  "TULSA": { address: "5809 S Yale Ave", city: "Tulsa", state: "OK", zipcode: "74135" },
  "VERNAL": { address: "1681 W Hwy 40", city: "Vernal", state: "UT", zipcode: "84078" },
  "WATFORD CITY": { address: "15008 39th Ln NW", city: "Watford City", state: "ND", zipcode: "58854" },
  "WICHITA": { address: "2440 S Meridian Ave", city: "Wichita", state: "KS", zipcode: "67213" },
  "WILLISTON": { address: "1416 2nd Ave W", city: "Williston", state: "ND", zipcode: "58801" }
};

async function updateRouteAddresses() {
  try {
    console.log('Starting route address updates...');
    
    let originUpdates = 0;
    let destinationUpdates = 0;
    
    for (const [locationName, locationInfo] of Object.entries(locationMapping)) {
      console.log(`Processing location: ${locationName}`);
      
      // Update routes where this location is the origin
      const originUpdateResult = await prisma.route.updateMany({
        where: {
          origin: {
            equals: locationName,
            mode: 'insensitive'
          }
        },
        data: {
          originAddress: locationInfo.address || null,
          originCity: locationInfo.city || null,
          originState: locationInfo.state || null,
          originZipCode: locationInfo.zipcode || null
        }
      });
      
      originUpdates += originUpdateResult.count;
      
      // Update routes where this location is the destination
      const destinationUpdateResult = await prisma.route.updateMany({
        where: {
          destination: {
            equals: locationName,
            mode: 'insensitive'
          }
        },
        data: {
          destinationAddress: locationInfo.address || null,
          destinationCity: locationInfo.city || null,
          destinationState: locationInfo.state || null,
          destinationZipCode: locationInfo.zipcode || null
        }
      });
      
      destinationUpdates += destinationUpdateResult.count;
      
      if (originUpdateResult.count > 0 || destinationUpdateResult.count > 0) {
        console.log(`  Updated ${originUpdateResult.count} origins and ${destinationUpdateResult.count} destinations`);
      }
    }
    
    console.log(`\nRoute address update completed!`);
    console.log(`Total origin updates: ${originUpdates}`);
    console.log(`Total destination updates: ${destinationUpdates}`);
    
    // Verify the updates
    const routesWithAddresses = await prisma.route.count({
      where: {
        OR: [
          { originAddress: { not: null } },
          { destinationAddress: { not: null } }
        ]
      }
    });
    
    console.log(`Routes with address information: ${routesWithAddresses}`);
    
  } catch (error) {
    console.error('Error updating route addresses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateRouteAddresses();