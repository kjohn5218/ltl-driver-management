import React, { useState, useEffect } from 'react';
import { Booking, Location } from '../../types';
import { format } from 'date-fns';
import { api } from '../../services/api';

// Parse multi-leg booking information from notes
const parseMultiLegBooking = (notes: string | null) => {
  if (!notes || !notes.includes('--- Multi-Leg Booking ---')) {
    return null;
  }
  
  const lines = notes.split('\n');
  const legs = [];
  
  for (const line of lines) {
    const legMatch = line.match(/^Leg (\d+): (.+) → (.+) \(\$(.+)\)$/);
    if (legMatch) {
      legs.push({
        legNumber: parseInt(legMatch[1]),
        origin: legMatch[2],
        destination: legMatch[3],
        rate: legMatch[4]
      });
    }
  }
  
  return legs.length > 0 ? legs : null;
};

interface RateConfirmationProps {
  booking: Booking;
  shipmentNumber: string;
}

export const RateConfirmation: React.FC<RateConfirmationProps> = ({ booking, shipmentNumber }) => {
  const currentDate = format(new Date(), 'MM/dd/yyyy h:mm a');
  const multiLegBooking = parseMultiLegBooking(booking.notes || null);
  const [locationData, setLocationData] = useState<{ [key: string]: Location }>({});

  // Fetch location data for origin and destination codes
  useEffect(() => {
    const fetchLocationData = async () => {
      const locationCodes = new Set<string>();
      
      // Collect all location codes from booking
      if (booking.origin) locationCodes.add(booking.origin);
      if (booking.destination) locationCodes.add(booking.destination);
      
      // Collect location codes from child bookings (for multi-leg)
      if (booking.childBookings) {
        booking.childBookings.forEach(child => {
          if (child.route?.origin) locationCodes.add(child.route.origin);
          if (child.route?.destination) locationCodes.add(child.route.destination);
          if (child.origin) locationCodes.add(child.origin);
          if (child.destination) locationCodes.add(child.destination);
        });
      }
      
      // Collect from route if available
      if (booking.route?.origin) locationCodes.add(booking.route.origin);
      if (booking.route?.destination) locationCodes.add(booking.route.destination);
      
      // Fetch location data for all codes
      const locations: { [key: string]: Location } = {};
      
      for (const code of locationCodes) {
        try {
          const response = await api.get(`/locations/search?q=${encodeURIComponent(code)}`);
          const matchingLocation = response.data.find((loc: Location) => 
            loc.code.toLowerCase() === code.toLowerCase()
          );
          if (matchingLocation) {
            locations[code] = matchingLocation;
          }
        } catch (error) {
          console.error(`Failed to fetch location data for ${code}:`, error);
        }
      }
      
      setLocationData(locations);
    };

    fetchLocationData();
  }, [booking]);

  // Helper function to get location data for a location code
  const getLocationData = (locationCode: string | undefined): Location | null => {
    if (!locationCode) return null;
    return locationData[locationCode] || null;
  };
  
  // Calculate appointment date considering midnight crossover
  const getAppointmentDate = (legNumber: number, baseTime: string = '21:00') => {
    const bookingDate = new Date(booking.bookingDate);
    
    // For leg 1, check if arrival crosses midnight
    if (legNumber === 1 && booking.route?.departureTime && booking.route?.runTime) {
      try {
        const [depHours, depMinutes] = booking.route.departureTime.split(':').map(Number);
        const departureMinutes = depHours * 60 + depMinutes;
        const arrivalMinutes = departureMinutes + booking.route.runTime;
        
        // If arrival is next day (crosses midnight)
        if (arrivalMinutes >= 24 * 60) {
          const nextDay = new Date(bookingDate);
          nextDay.setDate(nextDay.getDate() + 1);
          return format(nextDay, 'MM/dd/yyyy');
        }
      } catch (error) {
        console.error('Error calculating midnight crossover:', error);
      }
    }
    
    // For other legs or if no crossover, use base date
    if (legNumber === 2) {
      return `${format(bookingDate, 'MM/dd/yyyy')} 02:30`;
    }
    
    return `${format(bookingDate, 'MM/dd/yyyy')} ${baseTime}`;
  };
  
  // Calculate total miles using ACTUAL distance data from child bookings
  const getTotalMiles = () => {
    // If this is a multi-leg booking with child bookings, sum up the actual route distances
    if (booking.childBookings && booking.childBookings.length > 0) {
      return booking.childBookings.reduce((total, childBooking) => {
        return total + (childBooking.route?.distance || 0);
      }, 0);
    }
    
    // Fallback: If multi-leg booking exists in notes but no child bookings
    if (multiLegBooking) {
      // For multi-leg bookings, multiply the number of legs by typical distance
      // In your example, each leg FAR→MSP is 258 miles
      // This is a better approximation than using single route distance
      const legCount = multiLegBooking.length;
      
      // If we have a route distance, multiply by number of legs
      if (booking.route?.distance) {
        // For round trips or similar multi-legs, this gives better estimate
        return booking.route.distance * legCount;
      }
      
      // Otherwise use 258 miles per leg based on your example
      return legCount * 258;
    }
    
    // For single-leg bookings, use the route distance
    return booking.route?.distance || 184;
  };
  
  const totalMiles = getTotalMiles();
  
  return (
    <div className="rate-confirmation bg-white p-2" style={{ width: '8.5in', minHeight: '11in', fontFamily: 'Arial, sans-serif' }}>
      {/* Header - Rate Confirmation Title and Date */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-bold text-base">Load # {shipmentNumber}</div>
        </div>
        <div className="text-center">
          <div className="text-base font-bold">Rate Confirmation</div>
          <div className="text-xs text-gray-600">{currentDate} (CST)</div>
        </div>
      </div>

      {/* Logo */}
      <div className="text-center mb-1">
        <img src="/ccfs-logo.svg" alt="CCFS Logo" className="h-8 mx-auto" />
      </div>

      {/* Company Info */}
      <div className="text-center mb-2">
        <div className="font-bold text-base">CrossCounty Freight Solutions</div>
        <div className="text-xs">1929 Hancock Dr</div>
        <div className="text-xs">Bismarck, ND 58502</div>
      </div>

      {/* Carrier Information */}
      <table className="w-full border-2 border-black mb-1">
        <thead>
          <tr className="bg-black text-white">
            <th className="text-center py-1 text-xs">CARRIER</th>
            <th className="text-center py-1 text-xs">DATE</th>
            <th className="text-center py-1 text-xs">TIME</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-black">
            <td className="p-1 text-xs">{booking.carrier?.name || 'TBD'}</td>
            <td className="p-1 text-xs">{format(new Date(booking.bookingDate), 'MM/dd/yyyy')}</td>
            <td className="p-1 text-xs">21:00</td>
          </tr>
        </tbody>
      </table>

      {/* Vehicle Information */}
      <table className="w-full border-2 border-black mb-1">
        <thead>
          <tr className="bg-gray-200">
            <th className="border-r border-black p-1 text-left text-xs">MC #</th>
            <th className="border-r border-black p-1 text-left text-xs">DOT #</th>
            <th className="border-r border-black p-1 text-left text-xs">TRUCK #</th>
            <th className="border-r border-black p-1 text-left text-xs">TRAILER #</th>
            <th className="border-r border-black p-1 text-left text-xs">DRIVER</th>
            <th className="p-1 text-left text-xs">DRIVER PHONE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-r border-black p-1 text-xs">{booking.carrier?.mcNumber || ''}</td>
            <td className="border-r border-black p-1 text-xs">{booking.carrier?.dotNumber || ''}</td>
            <td className="border-r border-black p-1 text-xs"></td>
            <td className="border-r border-black p-1 text-xs"></td>
            <td className="border-r border-black p-1 text-xs">{booking.driverName || ''}</td>
            <td className="p-1 text-xs">{booking.phoneNumber || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Size & Type / Description */}
      <table className="w-full border-2 border-black mb-1">
        <thead>
          <tr className="bg-gray-200">
            <th className="border-r border-black p-1 text-left text-xs">SIZE & TYPE</th>
            <th className="border-r border-black p-1 text-left text-xs">DESCRIPTION</th>
            <th className="border-r border-black p-1 text-left text-xs">HU</th>
            <th className="border-r border-black p-1 text-left text-xs">HZ</th>
            <th className="border-r border-black p-1 text-left text-xs">TOTAL WEIGHT</th>
            <th className="p-1 text-left text-xs">MILES</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-r border-black p-1 text-xs">
              {booking.type === 'POWER_AND_TRAILER' && booking.trailerLength 
                ? `${booking.trailerLength} FT` 
                : 'Van 53 FT'}
            </td>
            <td className="border-r border-black p-1 text-xs">FAK</td>
            <td className="border-r border-black p-1 text-xs"></td>
            <td className="border-r border-black p-1 text-xs"></td>
            <td className="border-r border-black p-1 text-xs">35,000.00 LB</td>
            <td className="p-1 text-xs">{totalMiles}</td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      <div className="mb-1">
        <div className="border-2 border-black p-1 bg-gray-100">
          <div className="font-bold text-center mb-1 text-sm">NOTES</div>
          <div className="text-xs">
            For after hours dispatch assistance or to notify CCFS of any delay between the hours of 9:30 PM - 6:30 AM CT please call 701-204-0480.
          </div>
          {booking.notes && (
            <div className="mt-1 text-xs">{booking.notes}</div>
          )}
        </div>
      </div>


      {/* Legs */}
      {booking.childBookings && booking.childBookings.length > 0 ? (
        // Multi-leg booking: render using actual child booking data (limit to first 2 legs)
        booking.childBookings.slice(0, 2).map((childBooking, index) => (
          <div key={childBooking.id} className="border-2 border-black mb-1">
            <div className="bg-black text-white p-1 text-center font-bold text-xs">Leg {childBooking.legNumber}</div>
            <div className="p-1">
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="font-bold mb-1 text-xs">ORIGIN</div>
                    <div className="text-xs text-right">
                      <div><span className="font-bold">Depart Date/Time:</span> {getAppointmentDate(childBooking.legNumber || 1)}</div>
                    </div>
                  </div>
                  <div className="text-xs"><span className="font-bold">Location:</span> {childBooking.route?.origin}</div>
                  <div className="text-xs"><span className="font-bold">Address:</span> {childBooking.route?.originAddress || childBooking.originAddress || getLocationData(childBooking.route?.origin)?.address || '985 Glendale Avenue'}</div>
                  <div className="text-xs"><span className="font-bold">City, State Zip:</span> {childBooking.route?.originCity || childBooking.originCity || getLocationData(childBooking.route?.origin)?.city || 'SPARKS'}, {childBooking.route?.originState || childBooking.originState || getLocationData(childBooking.route?.origin)?.state || 'NV'} {childBooking.route?.originZipCode || childBooking.originZipCode || getLocationData(childBooking.route?.origin)?.zipCode || '89431'}</div>
                  <div className="text-xs"><span className="font-bold">Phone:</span> {getLocationData(childBooking.route?.origin)?.phone || '(775) 331-2311'} <span className="font-bold">Contact:</span> {childBooking.route?.originContact || childBooking.originContact || getLocationData(childBooking.route?.origin)?.contact || 'Brian Smith'}</div>
                  <div className="text-xs"><span className="font-bold">Hours:</span> {getLocationData(childBooking.route?.origin)?.hours || '04:00 -to-10:00'}</div>
                  {index === 0 && booking.carrierReportTime && (
                    <div className="text-xs"><span className="font-bold">Carrier Report Time:</span> {booking.carrierReportTime}</div>
                  )}
                </div>
                <div>
                  <div className="flex justify-between items-start">
                    <div className="font-bold mb-1 text-xs">DESTINATION</div>
                    <div className="text-xs text-right">
                      <div><span className="font-bold">Distance:</span> {childBooking.route?.distance || 0} miles</div>
                      <div><span className="font-bold">Rate:</span> ${childBooking.rate}</div>
                    </div>
                  </div>
                  <div className="text-xs"><span className="font-bold">Location:</span> {childBooking.route?.destination}</div>
                  <div className="text-xs"><span className="font-bold">Address:</span> {childBooking.route?.destinationAddress || childBooking.destinationAddress || getLocationData(childBooking.route?.destination)?.address || '2800 S El Dorado ST'}</div>
                  <div className="text-xs"><span className="font-bold">City, State Zip:</span> {childBooking.route?.destinationCity || childBooking.destinationCity || getLocationData(childBooking.route?.destination)?.city || 'STOCKTON'}, {childBooking.route?.destinationState || childBooking.destinationState || getLocationData(childBooking.route?.destination)?.state || 'CA'} {childBooking.route?.destinationZipCode || childBooking.destinationZipCode || getLocationData(childBooking.route?.destination)?.zipCode || '95206'}</div>
                  <div className="text-xs"><span className="font-bold">Phone:</span> {getLocationData(childBooking.route?.destination)?.phone || ''} <span className="font-bold">Contact:</span> {childBooking.route?.destinationContact || childBooking.destinationContact || getLocationData(childBooking.route?.destination)?.contact || ''}</div>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : multiLegBooking ? (
        // Fallback: Multi-leg booking using notes parsing (legacy support - limit to first 2 legs)
        multiLegBooking.slice(0, 2).map((leg, index) => (
          <div key={leg.legNumber} className="border-2 border-black mb-1">
            <div className="bg-black text-white p-1 text-center font-bold text-xs">Leg {leg.legNumber}</div>
            <div className="p-1">
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="font-bold mb-1 text-xs">ORIGIN</div>
                    <div className="text-xs text-right">
                      <div><span className="font-bold">Depart Date/Time:</span> {getAppointmentDate(leg.legNumber)}</div>
                    </div>
                  </div>
                  <div className="text-xs"><span className="font-bold">Location:</span> {leg.origin}</div>
                  <div className="text-xs"><span className="font-bold">Address:</span> {booking.originAddress || booking.route?.originAddress || getLocationData(leg.origin)?.address || '985 Glendale Avenue'}</div>
                  <div className="text-xs"><span className="font-bold">City, State Zip:</span> {booking.originCity || booking.route?.originCity || getLocationData(leg.origin)?.city || 'SPARKS'}, {booking.originState || booking.route?.originState || getLocationData(leg.origin)?.state || 'NV'} {booking.originZipCode || booking.route?.originZipCode || getLocationData(leg.origin)?.zipCode || '89431'}</div>
                  <div className="text-xs"><span className="font-bold">Phone:</span> {getLocationData(leg.origin)?.phone || '(775) 331-2311'} <span className="font-bold">Contact:</span> {booking.originContact || booking.route?.originContact || getLocationData(leg.origin)?.contact || 'Brian Smith'}</div>
                  <div className="text-xs"><span className="font-bold">Hours:</span> {getLocationData(leg.origin)?.hours || '04:00 -to-10:00'}</div>
                  {index === 0 && booking.carrierReportTime && (
                    <div className="text-xs"><span className="font-bold">Carrier Report Time:</span> {booking.carrierReportTime}</div>
                  )}
                </div>
                <div>
                  <div className="flex justify-between items-start">
                    <div className="font-bold mb-1 text-xs">DESTINATION</div>
                    <div className="text-xs text-right">
                      <div><span className="font-bold">Distance:</span> {booking.route?.distance || 258} miles</div>
                      <div><span className="font-bold">Rate:</span> ${leg.rate}</div>
                    </div>
                  </div>
                  <div className="text-xs"><span className="font-bold">Location:</span> {leg.destination}</div>
                  <div className="text-xs"><span className="font-bold">Address:</span> {booking.destinationAddress || booking.route?.destinationAddress || getLocationData(leg.destination)?.address || '2800 S El Dorado ST'}</div>
                  <div className="text-xs"><span className="font-bold">City, State Zip:</span> {booking.destinationCity || booking.route?.destinationCity || getLocationData(leg.destination)?.city || 'STOCKTON'}, {booking.destinationState || booking.route?.destinationState || getLocationData(leg.destination)?.state || 'CA'} {booking.destinationZipCode || booking.route?.destinationZipCode || getLocationData(leg.destination)?.zipCode || '95206'}</div>
                  <div className="text-xs"><span className="font-bold">Phone:</span> {getLocationData(leg.destination)?.phone || ''} <span className="font-bold">Contact:</span> {booking.destinationContact || booking.route?.destinationContact || getLocationData(leg.destination)?.contact || ''}</div>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
        // Single-leg booking: render original format
        <div className="border-2 border-black mb-1">
          <div className="bg-black text-white p-1 text-center font-bold text-xs">Leg 1</div>
          <div className="p-1">
            <div className="grid grid-cols-2 gap-1">
              <div>
                <div className="flex justify-between items-start">
                  <div className="font-bold mb-1 text-xs">ORIGIN</div>
                  <div className="text-xs text-right">
                    <div><span className="font-bold">Depart Date/Time:</span> {getAppointmentDate(1)}</div>
                  </div>
                </div>
                <div className="text-xs"><span className="font-bold">Name:</span> CrossCounty Freight Solutions - RNO</div>
                <div className="text-xs"><span className="font-bold">Address:</span> {booking.originAddress || booking.route?.originAddress || getLocationData(booking.origin || booking.route?.origin)?.address || '985 Glendale Avenue'}</div>
                <div className="text-xs"><span className="font-bold">City, State Zip:</span> {booking.originCity || booking.route?.originCity || getLocationData(booking.origin || booking.route?.origin)?.city || 'SPARKS'}, {booking.originState || booking.route?.originState || getLocationData(booking.origin || booking.route?.origin)?.state || 'NV'} {booking.originZipCode || booking.route?.originZipCode || getLocationData(booking.origin || booking.route?.origin)?.zipCode || '89431'}</div>
                <div className="text-xs"><span className="font-bold">Phone:</span> {getLocationData(booking.origin || booking.route?.origin)?.phone || '(775) 331-2311'} <span className="font-bold">Contact:</span> {booking.originContact || booking.route?.originContact || getLocationData(booking.origin || booking.route?.origin)?.contact || 'Brian Smith'}</div>
                <div className="text-xs"><span className="font-bold">Hours:</span> {getLocationData(booking.origin || booking.route?.origin)?.hours || '04:00 -to-10:00'}</div>
                {booking.carrierReportTime && (
                  <div className="text-xs"><span className="font-bold">Carrier Report Time:</span> {booking.carrierReportTime}</div>
                )}
              </div>
              <div>
                <div className="flex justify-between items-start">
                  <div className="font-bold mb-1 text-xs">DESTINATION</div>
                  <div className="text-xs text-right">
                    <div><span className="font-bold">Distance:</span> {booking.route?.distance || 184} miles</div>
                    <div><span className="font-bold">Rate:</span> ${booking.rate}</div>
                  </div>
                </div>
                <div className="text-xs"><span className="font-bold">Name:</span> DDP</div>
                <div className="text-xs"><span className="font-bold">Address:</span> {booking.destinationAddress || booking.route?.destinationAddress || getLocationData(booking.destination || booking.route?.destination)?.address || '2800 S El Dorado ST'}</div>
                <div className="text-xs"><span className="font-bold">City, State Zip:</span> {booking.destinationCity || booking.route?.destinationCity || getLocationData(booking.destination || booking.route?.destination)?.city || 'STOCKTON'}, {booking.destinationState || booking.route?.destinationState || getLocationData(booking.destination || booking.route?.destination)?.state || 'CA'} {booking.destinationZipCode || booking.route?.destinationZipCode || getLocationData(booking.destination || booking.route?.destination)?.zipCode || '95206'}</div>
                <div className="text-xs"><span className="font-bold">Phone:</span> {getLocationData(booking.destination || booking.route?.destination)?.phone || ''} <span className="font-bold">Contact:</span> {booking.destinationContact || booking.route?.destinationContact || getLocationData(booking.destination || booking.route?.destination)?.contact || ''}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-2 border-black p-1 mb-1 bg-gray-100">
        <div className="text-center font-bold mb-1 text-xs">CHECK IN WITH DISPATCH FOR PAPERWORK AND DOOR ASSIGNMENT</div>
        <div className="text-xs space-y-0">
          <div>Maintain Seal Integrity - seal loads prior to departure and record number on manifest</div>
          <div>Departure and arrival of each stop MUST be recorded in real-time on a mobile browser at driver.ccfs.com.</div>
          <div>To advise of delays or for assistance contact Linehaul Support at 701-204-0480 (M-F 9:30 PM – 6:30 AM CT) or contact the CCFS service center.</div>
        </div>
      </div>

      {/* Charges */}
      <table className="w-full border-2 border-black mb-1">
        <thead>
          <tr className="bg-black text-white">
            <th colSpan={2} className="p-1 text-center text-xs">CHARGES</th>
          </tr>
        </thead>
        <tbody>
          {booking.rateType === 'FLAT_RATE' && (
            <tr className="border-b border-black">
              <td className="p-1 text-xs">Rate Type: {booking.rateType || 'FLAT_RATE'} - Rate</td>
              <td className="p-1 text-right text-xs">${booking.rate}</td>
            </tr>
          )}
          {booking.rateType === 'MILE' && (
            <tr className="border-b border-black">
              <td className="p-1 text-xs">Rate Type: {booking.rateType} - Base Rate (${booking.baseRate || booking.rate} × {totalMiles} miles)</td>
              <td className="p-1 text-right text-xs">${booking.rate}</td>
            </tr>
          )}
          {booking.rateType === 'MILE_FSC' && (
            <>
              <tr className="border-b border-black">
                <td className="p-1 text-xs">Rate Type: {booking.rateType} - Base Rate (${booking.baseRate || '0.00'} × {totalMiles} miles)</td>
                <td className="p-1 text-right text-xs">${((booking.baseRate || 0) * totalMiles).toFixed(2)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1 text-xs">Fuel Surcharge ({booking.fscRate || 0}% of base rate)</td>
                <td className="p-1 text-right text-xs">${(((booking.baseRate || 0) * totalMiles) * ((booking.fscRate || 0) / 100)).toFixed(2)}</td>
              </tr>
            </>
          )}
          <tr className="bg-gray-100">
            <td className="p-1 font-bold text-xs">TOTAL RATE</td>
            <td className="p-1 text-right font-bold text-xs">${booking.rate} US Dollars</td>
          </tr>
        </tbody>
      </table>

      {/* E-Signature Agreement Section */}
      <div className="border-2 border-black mb-1">
        <div className="bg-black text-white p-1 text-center font-bold text-xs">
          E-SIGNATURE AGREEMENT
        </div>
        <div style={{ minHeight: '30px' }} className="p-1">
          {/* Minimal signature area */}
        </div>
        
        {/* Signature Line */}
        <div className="flex justify-between items-end p-1">
          <div className="flex-1">
            <div className="text-xs">Carrier Signature</div>
            <div className="border-b-2 border-black w-full"></div>
          </div>
          <div className="mx-2">
            <div className="text-xs">Date</div>
            <div className="flex gap-1 text-xs">
              <div className="border-b border-black w-4"></div>
              <span>/</span>
              <div className="border-b border-black w-4"></div>
              <span>/</span>
              <div className="border-b border-black w-8"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Instructions */}
      <div className="mb-2 text-center">
        <div className="font-bold text-xs">Please email a copy of the rate confirmation, load manifest and invoice to: linehaulmanagement@ccfs.com.</div>
      </div>

    </div>
  );
};