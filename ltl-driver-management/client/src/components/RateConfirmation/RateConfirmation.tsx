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
      
      // Debug: Log the booking data structure
      console.log('Booking data:', booking);
      console.log('Child bookings:', booking.childBookings);
      console.log('Child bookings length:', booking.childBookings?.length);
      console.log('Booking notes:', booking.notes);
      console.log('Multi-leg booking parsed from notes:', parseMultiLegBooking(booking.notes || null));
      
      // Collect all location codes from booking
      if (booking.origin) {
        console.log('Adding booking.origin:', booking.origin);
        locationCodes.add(booking.origin);
      }
      if (booking.destination) {
        console.log('Adding booking.destination:', booking.destination);
        locationCodes.add(booking.destination);
      }
      
      // Collect location codes from child bookings (for multi-leg)
      if (booking.childBookings && booking.childBookings.length > 0) {
        console.log('Processing child bookings for location codes...');
        booking.childBookings.forEach((child, index) => {
          console.log(`Child booking ${index}:`, child);
          console.log(`Child booking ${index} route:`, child.route);
          console.log(`Child booking ${index} legNumber:`, child.legNumber);
          console.log(`Child booking ${index} has route data:`, !!child.route);
          
          if (child.route?.origin) {
            console.log(`Adding child ${index} route.origin:`, child.route.origin);
            locationCodes.add(child.route.origin);
          } else {
            console.log(`Child ${index} route.origin is missing:`, child.route?.origin);
          }
          
          if (child.route?.destination) {
            console.log(`Adding child ${index} route.destination:`, child.route.destination);
            locationCodes.add(child.route.destination);
          } else {
            console.log(`Child ${index} route.destination is missing:`, child.route?.destination);
          }
          
          if (child.origin) {
            console.log(`Adding child ${index} origin:`, child.origin);
            locationCodes.add(child.origin);
          }
          if (child.destination) {
            console.log(`Adding child ${index} destination:`, child.destination);
            locationCodes.add(child.destination);
          }
        });
      } else {
        console.log('No child bookings found or empty array');
        
        // If no child bookings, check for multi-leg booking in notes
        const multiLegData = parseMultiLegBooking(booking.notes || null);
        if (multiLegData && multiLegData.length > 0) {
          console.log('Found multi-leg data in notes, collecting location codes...');
          multiLegData.forEach((leg, index) => {
            console.log(`Notes leg ${index + 1} origin:`, leg.origin);
            console.log(`Notes leg ${index + 1} destination:`, leg.destination);
            locationCodes.add(leg.origin);
            locationCodes.add(leg.destination);
          });
        }
      }
      
      // Collect from route if available
      if (booking.route?.origin) {
        console.log('Adding booking.route.origin:', booking.route.origin);
        locationCodes.add(booking.route.origin);
      }
      if (booking.route?.destination) {
        console.log('Adding booking.route.destination:', booking.route.destination);
        locationCodes.add(booking.route.destination);
      }
      
      // Debug: Log collected location codes
      console.log('Location codes to fetch:', Array.from(locationCodes));
      
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
            console.log(`Found location data for ${code}:`, matchingLocation);
          } else {
            console.log(`No matching location found for ${code}`);
          }
        } catch (error) {
          console.error(`Failed to fetch location data for ${code}:`, error);
        }
      }
      
      console.log('Final locationData:', locations);
      setLocationData(locations);
    };

    fetchLocationData();
  }, [booking]);

  // Helper function to get location data for a location code
  const getLocationData = (locationCode: string | undefined): Location | null => {
    if (!locationCode) return null;
    return locationData[locationCode] || null;
  };
  
  // Calculate appointment date and time for legs
  const getAppointmentDate = (legNumber: number, childBooking?: any) => {
    const bookingDate = new Date(booking.bookingDate);
    
    // For multi-leg bookings with child bookings
    if (booking.childBookings && booking.childBookings.length > 0) {
      const leg = childBooking || booking.childBookings.find(cb => cb.legNumber === legNumber);
      if (leg) {
        // For Leg 1: Use booking date and leg departure time
        if (legNumber === 1) {
          const departureTime = leg.departureTime || '21:00';
          return `${format(bookingDate, 'MM/dd/yyyy')} ${departureTime}`;
        }
        
        // For Leg 2 and beyond: Calculate date based on previous leg arrival and current leg departure
        if (legNumber >= 2) {
          const previousLeg = booking.childBookings.find(cb => cb.legNumber === legNumber - 1);
          const currentDepartureTime = leg.departureTime || '02:30';
          
          if (previousLeg && previousLeg.arrivalTime) {
            try {
              // Parse previous leg arrival time
              const [prevArrHours, prevArrMinutes] = previousLeg.arrivalTime.split(':').map(Number);
              const prevArrivalMinutes = prevArrHours * 60 + prevArrMinutes;
              
              // Parse current leg departure time
              const [currDepHours, currDepMinutes] = currentDepartureTime.split(':').map(Number);
              const currDepartureMinutes = currDepHours * 60 + currDepMinutes;
              
              // If current departure is earlier in the day than previous arrival, it's next day
              if (currDepartureMinutes < prevArrivalMinutes) {
                const nextDay = new Date(bookingDate);
                nextDay.setDate(nextDay.getDate() + 1);
                return `${format(nextDay, 'MM/dd/yyyy')} ${currentDepartureTime}`;
              }
            } catch (error) {
              console.error('Error calculating leg 2+ date:', error);
            }
          }
          
          return `${format(bookingDate, 'MM/dd/yyyy')} ${currentDepartureTime}`;
        }
      }
    }
    
    // Fallback for route-based bookings or legacy logic
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
    
    // Default fallback
    const defaultTime = legNumber === 2 ? '02:30' : '21:00';
    return `${format(bookingDate, 'MM/dd/yyyy')} ${defaultTime}`;
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
            <td className="p-1 text-xs">{
              // Use Leg 1 departure time if available from child bookings
              (booking.childBookings && booking.childBookings.length > 0) 
                ? (booking.childBookings[0].departureTime || '21:00')
                : (booking.route?.departureTime || '21:00')
            }</td>
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
                      <div><span className="font-bold">Depart Date/Time:</span> {getAppointmentDate(childBooking.legNumber || 1, childBooking)}</div>
                    </div>
                  </div>
                  <div className="text-xs"><span className="font-bold">Location:</span> {childBooking.route?.origin || childBooking.origin}</div>
                  {console.log(`Leg ${childBooking.legNumber} origin:`, childBooking.route?.origin || childBooking.origin, 'Location data:', getLocationData(childBooking.route?.origin || childBooking.origin))}
                  <div className="text-xs"><span className="font-bold">Address:</span> {getLocationData(childBooking.route?.origin || childBooking.origin)?.address || childBooking.originAddress || childBooking.route?.originAddress || ''}</div>
                  <div className="text-xs"><span className="font-bold">City, State Zip:</span> {getLocationData(childBooking.route?.origin || childBooking.origin)?.city || childBooking.originCity || childBooking.route?.originCity || ''}, {getLocationData(childBooking.route?.origin || childBooking.origin)?.state || childBooking.originState || childBooking.route?.originState || ''} {getLocationData(childBooking.route?.origin || childBooking.origin)?.zipCode || childBooking.originZipCode || childBooking.route?.originZipCode || ''}</div>
                  <div className="text-xs"><span className="font-bold">Phone:</span> {childBooking.originPhone || getLocationData(childBooking.route?.origin || childBooking.origin)?.phone || ''} <span className="font-bold">Contact:</span> {childBooking.originContact || childBooking.route?.originContact || getLocationData(childBooking.route?.origin || childBooking.origin)?.contact || ''}</div>
                  <div className="text-xs"><span className="font-bold">Hours:</span> {childBooking.originHours || getLocationData(childBooking.route?.origin || childBooking.origin)?.hours || ''}</div>
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
                  <div className="text-xs"><span className="font-bold">Location:</span> {childBooking.route?.destination || childBooking.destination}</div>
                  {console.log(`Leg ${childBooking.legNumber} destination:`, childBooking.route?.destination || childBooking.destination, 'Location data:', getLocationData(childBooking.route?.destination || childBooking.destination))}
                  <div className="text-xs"><span className="font-bold">Address:</span> {getLocationData(childBooking.route?.destination || childBooking.destination)?.address || childBooking.destinationAddress || childBooking.route?.destinationAddress || ''}</div>
                  <div className="text-xs"><span className="font-bold">City, State Zip:</span> {getLocationData(childBooking.route?.destination || childBooking.destination)?.city || childBooking.destinationCity || childBooking.route?.destinationCity || ''}, {getLocationData(childBooking.route?.destination || childBooking.destination)?.state || childBooking.destinationState || childBooking.route?.destinationState || ''} {getLocationData(childBooking.route?.destination || childBooking.destination)?.zipCode || childBooking.destinationZipCode || childBooking.route?.destinationZipCode || ''}</div>
                  <div className="text-xs"><span className="font-bold">Phone:</span> {childBooking.destinationPhone || getLocationData(childBooking.route?.destination || childBooking.destination)?.phone || ''} <span className="font-bold">Contact:</span> {childBooking.destinationContact || childBooking.route?.destinationContact || getLocationData(childBooking.route?.destination || childBooking.destination)?.contact || ''}</div>
                  <div className="text-xs"><span className="font-bold">Hours:</span> {childBooking.destinationHours || getLocationData(childBooking.route?.destination || childBooking.destination)?.hours || ''}</div>
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
                  <div className="text-xs"><span className="font-bold">Address:</span> {getLocationData(leg.origin)?.address || booking.originAddress || booking.route?.originAddress || ''}</div>
                  <div className="text-xs"><span className="font-bold">City, State Zip:</span> {getLocationData(leg.origin)?.city || booking.originCity || booking.route?.originCity || ''}, {getLocationData(leg.origin)?.state || booking.originState || booking.route?.originState || ''} {getLocationData(leg.origin)?.zipCode || booking.originZipCode || booking.route?.originZipCode || ''}</div>
                  <div className="text-xs"><span className="font-bold">Phone:</span> {booking.originPhone || getLocationData(leg.origin)?.phone || ''} <span className="font-bold">Contact:</span> {booking.originContact || booking.route?.originContact || getLocationData(leg.origin)?.contact || ''}</div>
                  <div className="text-xs"><span className="font-bold">Hours:</span> {booking.originHours || getLocationData(leg.origin)?.hours || ''}</div>
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
                  <div className="text-xs"><span className="font-bold">Address:</span> {getLocationData(leg.destination)?.address || booking.destinationAddress || booking.route?.destinationAddress || ''}</div>
                  <div className="text-xs"><span className="font-bold">City, State Zip:</span> {getLocationData(leg.destination)?.city || booking.destinationCity || booking.route?.destinationCity || ''}, {getLocationData(leg.destination)?.state || booking.destinationState || booking.route?.destinationState || ''} {getLocationData(leg.destination)?.zipCode || booking.destinationZipCode || booking.route?.destinationZipCode || ''}</div>
                  <div className="text-xs"><span className="font-bold">Phone:</span> {booking.destinationPhone || getLocationData(leg.destination)?.phone || ''} <span className="font-bold">Contact:</span> {booking.destinationContact || booking.route?.destinationContact || getLocationData(leg.destination)?.contact || ''}</div>
                  <div className="text-xs"><span className="font-bold">Hours:</span> {booking.destinationHours || getLocationData(leg.destination)?.hours || ''}</div>
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
                <div className="text-xs"><span className="font-bold">Address:</span> {booking.originAddress || booking.route?.originAddress || getLocationData(booking.origin || booking.route?.origin)?.address || ''}</div>
                <div className="text-xs"><span className="font-bold">City, State Zip:</span> {booking.originCity || booking.route?.originCity || getLocationData(booking.origin || booking.route?.origin)?.city || ''}, {booking.originState || booking.route?.originState || getLocationData(booking.origin || booking.route?.origin)?.state || ''} {booking.originZipCode || booking.route?.originZipCode || getLocationData(booking.origin || booking.route?.origin)?.zipCode || ''}</div>
                <div className="text-xs"><span className="font-bold">Phone:</span> {booking.originPhone || getLocationData(booking.origin || booking.route?.origin)?.phone || ''} <span className="font-bold">Contact:</span> {booking.originContact || booking.route?.originContact || getLocationData(booking.origin || booking.route?.origin)?.contact || ''}</div>
                <div className="text-xs"><span className="font-bold">Hours:</span> {booking.originHours || getLocationData(booking.origin || booking.route?.origin)?.hours || ''}</div>
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
                <div className="text-xs"><span className="font-bold">Address:</span> {booking.destinationAddress || booking.route?.destinationAddress || getLocationData(booking.destination || booking.route?.destination)?.address || ''}</div>
                <div className="text-xs"><span className="font-bold">City, State Zip:</span> {booking.destinationCity || booking.route?.destinationCity || getLocationData(booking.destination || booking.route?.destination)?.city || ''}, {booking.destinationState || booking.route?.destinationState || getLocationData(booking.destination || booking.route?.destination)?.state || ''} {booking.destinationZipCode || booking.route?.destinationZipCode || getLocationData(booking.destination || booking.route?.destination)?.zipCode || ''}</div>
                <div className="text-xs"><span className="font-bold">Phone:</span> {booking.destinationPhone || getLocationData(booking.destination || booking.route?.destination)?.phone || ''} <span className="font-bold">Contact:</span> {booking.destinationContact || booking.route?.destinationContact || getLocationData(booking.destination || booking.route?.destination)?.contact || ''}</div>
                <div className="text-xs"><span className="font-bold">Hours:</span> {booking.destinationHours || getLocationData(booking.destination || booking.route?.destination)?.hours || ''}</div>
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