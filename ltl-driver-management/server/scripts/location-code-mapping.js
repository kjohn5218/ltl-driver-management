const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapping between route location codes and full location names from Excel
const locationCodeMapping = {
  'ABQ': 'ALBUQUERQUE',
  'AHL': 'ASHTON HILL',
  'ALP': 'ALPINE',
  'AMA': 'AMARILLO',
  'BEL': 'BELFIELD',
  'BIL': 'BILLINGS',
  'BIS': 'BISMARCK',
  'BOI': 'BOISE',
  'BTM': 'BRAMAN',
  'CPR': 'CASPER',
  'CHA': 'CHEYENNE',
  'CSC': 'COLORADO SPRINGS',
  'DEN': 'DENVER',
  'DIK': 'DICKINSON',
  'ELP': 'EL PASO',
  'FSM': 'FARMINGTON',
  'DFW': 'FORT WORTH',
  'GJT': 'GRAND JUNCTION',
  'GTF': 'GREAT FALLS',
  'HOU': 'HOUSTON',
  'KCY': 'KANSAS CITY',
  'LAS': 'LAS VEGAS',
  'MID': 'MIDLAND',
  'MOT': 'MINOT',
  'OKC': 'OKLAHOMA CITY',
  'PHX': 'PHOENIX',
  'PUB': 'PUEBLO',
  'RPC': 'RAPID CITY',
  'RNO': 'RENO',
  'ROW': 'ROSWELL',
  'SLC': 'SALT LAKE CITY',
  'TUS': 'TUCSON',
  'FAR': 'FARGO', // This appears to be Fargo from the location mapping JSON
  'PIE': 'PIERRE',
  'MSP': 'MINNESOTA', // Minneapolis-St. Paul area
  'DSM': 'DES MOINES',
  'OMA': 'LA VISTA', // Omaha area
  'STL': 'ST LOUIS',
  'KSP': 'KALISPELL',
  'MSO': 'MISSOULA',
  'HLN': 'HELENA',
  'BZN': 'BELGRADE', // Bozeman area
  'DLG': 'DEER LODGE',
  'BVR': 'BEAVER',
  'FIL': 'FILLMORE',
  'SGU': 'HURRICANE', // St. George area
  'SNO': 'SNOWVILLE',
  'IDA': 'IDAHO FALLS',
  'DUB': 'DUBOIS',
  'OSB': 'OSBOURNE BRIDGE',
  'SGJ': 'SAGE JUNCTION',
  'GAR': 'GARDEN CITY',
  'HAY': 'HAYS',
  'WAK': 'WAKEENEY',
  'OAK': 'OAKLEY',
  'GRI': 'GRAND ISLAND',
  'NPL': 'NORTH PLATTE',
  'LEX': 'LEXINGTON',
  'LIM': 'LIMA',
  'GFK': 'GRAND FORKS',
  'JMS': 'JAMESTOWN',
  'FOS': 'FOSSTON',
  'LQR': 'LONG PRAIRIE',
  'LIT': 'LITCHFIELD',
  'DAY': 'DAYTON',
  'SGF': 'SPRINGFIELD',
  'SXF': 'SIOUX FALLS',
  'PIE': 'PIERRE',
  'RPC': 'RAPID CITY',
  'WAM': 'WAMSUTTER'
};

// Location mapping from Excel file (cleaned zipcode format)
const locationMapping = {
  "ALBUQUERQUE": { address: "4200 Ellison St NE", city: "Albuquerque", state: "NM", zipcode: "87109" },
  "ASHTON HILL": { address: "", city: "Ashton Hill", state: "ID", zipcode: "83420" },
  "ALPINE": { address: "2407 Old Marathon Rd", city: "Alpine", state: "TX", zipcode: "79831" },
  "AMARILLO": { address: "715 S Lakeside Dr", city: "Amarillo", state: "TX", zipcode: "79118" },
  "BELFIELD": { address: "804 US-85", city: "Belfield", state: "ND", zipcode: "58622" },
  "BILLINGS": { address: "2660 Gabel Rd", city: "Billings", state: "MT", zipcode: "59102" },
  "BISMARCK": { address: "1841 Hancock Dr", city: "Bismarck", state: "ND", zipcode: "58501" },
  "BOISE": { address: "2840 S Cole Rd", city: "Boise", state: "ID", zipcode: "83709" },
  "BRAMAN": { address: "9695 177 N Highway", city: "Braman", state: "OK", zipcode: "74632" },
  "CASPER": { address: "150 Walsh Dr", city: "Casper", state: "WY", zipcode: "82609" },
  "CHEYENNE": { address: "2810 E Lincolnway", city: "Cheyenne", state: "WY", zipcode: "82001" },
  "COLORADO SPRINGS": { address: "2050 Rimrock Dr", city: "Colorado Springs", state: "CO", zipcode: "80915" },
  "DENVER": { address: "4100 E 45th Ave", city: "Denver", state: "CO", zipcode: "80216" },
  "DICKINSON": { address: "416 23rd Ave E", city: "Dickinson", state: "ND", zipcode: "58601" },
  "EL PASO": { address: "1451 Goodyear Dr", city: "El Paso", state: "TX", zipcode: "79936" },
  "FARMINGTON": { address: "901 W Apache St", city: "Farmington", state: "NM", zipcode: "87401" },
  "FORT WORTH": { address: "1205 Westport Pkwy", city: "Fort Worth", state: "TX", zipcode: "76177" },
  "GRAND JUNCTION": { address: "745 23 1/2 Rd", city: "Grand Junction", state: "CO", zipcode: "81505" },
  "GREAT FALLS": { address: "4144 N Park Trail", city: "Great Falls", state: "MT", zipcode: "59405" },
  "HOUSTON": { address: "3340-D Greens Rd, Suite 800", city: "Houston", state: "TX", zipcode: "77032" },
  "KANSAS CITY": { address: "5010 Speaker Rd", city: "Kansas City", state: "KS", zipcode: "66106" },
  "LAS VEGAS": { address: "4480 E Cheyenne Ave", city: "Las Vegas", state: "NV", zipcode: "89115" },
  "MIDLAND": { address: "3302 Garden City Highway", city: "Midland", state: "TX", zipcode: "79706" },
  "MINOT": { address: "2108 20th Ave SW", city: "Minot", state: "ND", zipcode: "58701" },
  "OKLAHOMA CITY": { address: "5400 SW 29th St", city: "Oklahoma City", state: "OK", zipcode: "73179" },
  "PHOENIX": { address: "1845 N 27th Ave", city: "Phoenix", state: "AZ", zipcode: "85009" },
  "PUEBLO": { address: "400 W D St", city: "Pueblo", state: "CO", zipcode: "81003" },
  "RAPID CITY": { address: "540 Deadwood Ave", city: "Rapid City", state: "SD", zipcode: "57702" },
  "RENO": { address: "985 Glendale Ave", city: "Sparks", state: "NV", zipcode: "89431" },
  "ROSWELL": { address: "601 E College Blvd", city: "Roswell", state: "NM", zipcode: "88201" },
  "SALT LAKE CITY": { address: "185 S Redwood Rd", city: "North Salt Lake", state: "UT", zipcode: "84054" },
  "TUCSON": { address: "3350 E Ajo Way", city: "Tucson", state: "AZ", zipcode: "85713" },
  "FARGO": { address: "5669 13th Ave N", city: "Fargo", state: "ND", zipcode: "58102" },
  "PIERRE": { address: "1875 N Airport Rd", city: "Pierre", state: "SD", zipcode: "57501" },
  "DES MOINES": { address: "5299 NE 22nd St", city: "Des Moines", state: "IA", zipcode: "50313" },
  "LA VISTA": { address: "12021 Roberts Rd", city: "La Vista", state: "NE", zipcode: "68128" },
  "ST LOUIS": { address: "164 NW Industrial Ct", city: "St Louis", state: "MO", zipcode: "63044" },
  "KALISPELL": { address: "3340 Hwy 2 East", city: "Kalispell", state: "MT", zipcode: "59901" },
  "MISSOULA": { address: "6201 Expressway", city: "Missoula", state: "MT", zipcode: "59808" },
  "HELENA": { address: "1450 Carter Dr", city: "Helena", state: "MT", zipcode: "59601" },
  "BELGRADE": { address: "48 Woodbury Ave", city: "Belgrade", state: "MT", zipcode: "59714" },
  "DEER LODGE": { address: "1220 N Main St", city: "Deer Lodge", state: "MT", zipcode: "59722" },
  "BEAVER": { address: "1401 S Main St", city: "Beaver", state: "UT", zipcode: "84713" },
  "FILLMORE": { address: "965 UT-99", city: "Fillmore", state: "UT", zipcode: "84631" },
  "HURRICANE": { address: "321 N Old Hwy 91", city: "Hurricane", state: "UT", zipcode: "84737" },
  "SNOWVILLE": { address: "90 S Stone Rd", city: "Snowville", state: "UT", zipcode: "84336" },
  "IDAHO FALLS": { address: "1545 W Sunnyside Rd", city: "Idaho Falls", state: "ID", zipcode: "83402" },
  "DUBOIS": { address: "424 W Main St", city: "Dubois", state: "ID", zipcode: "83423" },
  "OSBOURNE BRIDGE": { address: "", city: "Osbourne Bridge", state: "ID", zipcode: "83429" },
  "SAGE JUNCTION": { address: "", city: "Sage Junction", state: "ID", zipcode: "83444" },
  "GARDEN CITY": { address: "240 Industrial Dr", city: "Garden City", state: "KS", zipcode: "67846" },
  "HAYS": { address: "1198 280th Ave", city: "Hays", state: "KS", zipcode: "67601" },
  "WAKEENEY": { address: "745 S 1st St", city: "Wakeeney", state: "KS", zipcode: "67672" },
  "OAKLEY": { address: "1001 US-40", city: "Oakley", state: "KS", zipcode: "67748" },
  "GRAND ISLAND": { address: "5162 S Elk Dr", city: "Grand Island", state: "NE", zipcode: "68801" },
  "NORTH PLATTE": { address: "301 E Fremont Dr", city: "North Platte", state: "NE", zipcode: "69101" },
  "LEXINGTON": { address: "", city: "Lexington", state: "NE", zipcode: "" },
  "LIMA": { address: "", city: "Lima", state: "MT", zipcode: "59739" },
  "GRAND FORKS": { address: "5028 Gateway Dr", city: "Grand Forks", state: "ND", zipcode: "58201" },
  "JAMESTOWN": { address: "1910 27th Ave SE", city: "Jamestown", state: "ND", zipcode: "58401" },
  "FOSSTON": { address: "920 Airport Rd", city: "Fosston", state: "MN", zipcode: "56542" },
  "LONG PRAIRIE": { address: "22401 County Rd 36", city: "Long Prairie", state: "MN", zipcode: "56347" },
  "LITCHFIELD": { address: "520 Polydome Drive", city: "Litchfield", state: "MN", zipcode: "55355" },
  "DAYTON": { address: "12700 West French Lake Rd", city: "Dayton", state: "MN", zipcode: "55369" },
  "SPRINGFIELD": { address: "1454 N Hampton Ave", city: "Springfield", state: "MO", zipcode: "65802" },
  "SIOUX FALLS": { address: "1508 E Robur Dr", city: "Sioux Falls", state: "SD", zipcode: "57104" },
  "WAMSUTTER": { address: "314 Kelly Rd", city: "Wamsutter", state: "WY", zipcode: "82336" }
};

async function updateRouteAddressesByCode() {
  try {
    console.log('Starting route address updates using location codes...');
    
    let originUpdates = 0;
    let destinationUpdates = 0;
    
    for (const [locationCode, fullLocationName] of Object.entries(locationCodeMapping)) {
      const locationInfo = locationMapping[fullLocationName];
      
      if (!locationInfo) {
        console.log(`  Warning: No address info found for ${fullLocationName}`);
        continue;
      }
      
      console.log(`Processing ${locationCode} -> ${fullLocationName}`);
      
      // Update routes where this location code is the origin
      const originUpdateResult = await prisma.route.updateMany({
        where: {
          origin: locationCode
        },
        data: {
          originAddress: locationInfo.address || null,
          originCity: locationInfo.city || null,
          originState: locationInfo.state || null,
          originZipCode: locationInfo.zipcode || null
        }
      });
      
      originUpdates += originUpdateResult.count;
      
      // Update routes where this location code is the destination
      const destinationUpdateResult = await prisma.route.updateMany({
        where: {
          destination: locationCode
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
updateRouteAddressesByCode();