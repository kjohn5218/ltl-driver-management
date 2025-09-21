import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Calendar, Truck, MapPin, AlertCircle, X, Plus } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { LocationAutocomplete } from '../components/LocationAutocomplete';
import { useAuth } from '../contexts/AuthContext';
import { Location } from '../types';

type RateType = 'MILE' | 'MILE_FSC' | 'FLAT_RATE';

interface UnifiedLeg {
  id: string;
  type: 'route' | 'custom';
  // Route fields
  routeId?: string;
  routeName?: string;
  // Common fields
  origin: string;
  destination: string;
  miles: number;
  // Rate fields
  rateType: RateType;
  baseRate: string;
  totalRate: string;
  // Time fields
  departureTime?: string;
  arrivalTime?: string;
  reportTime?: string;
  // Location data for address details
  originLocation?: Location | null;
  destinationLocation?: Location | null;
}

interface NewBookingSimplifiedProps {
  copyFromBooking?: any;
}

export const NewBookingSimplified: React.FC<NewBookingSimplifiedProps> = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  
  // Basic booking info
  const [carrierId, setCarrierId] = useState('');
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [useMultipleDates, setUseMultipleDates] = useState(false);
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [bookingType, setBookingType] = useState<'POWER_ONLY' | 'POWER_AND_TRAILER'>('POWER_ONLY');
  const [trailerLength, setTrailerLength] = useState('');
  const [fuelSurchargeRate, setFuelSurchargeRate] = useState<number>(0);
  
  // Contact info
  const [driverName, setDriverName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [carrierEmail, setCarrierEmail] = useState('');
  const [carrierReportTime, setCarrierReportTime] = useState('');
  
  // Leg management
  const [legs, setLegs] = useState<UnifiedLeg[]>([]);
  const [showLegBuilder, setShowLegBuilder] = useState(true);
  
  // Current leg builder state
  const [legType, setLegType] = useState<'route' | 'custom'>('route');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [customOrigin, setCustomOrigin] = useState('');
  const [customDestination, setCustomDestination] = useState('');
  const [customMiles, setCustomMiles] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  // Selected location objects for address details
  const [selectedOriginLocation, setSelectedOriginLocation] = useState<Location | null>(null);
  const [selectedDestinationLocation, setSelectedDestinationLocation] = useState<Location | null>(null);
  const [legDepartureTime, setLegDepartureTime] = useState('');
  const [legArrivalTime, setLegArrivalTime] = useState('');
  const [legReportTime, setLegReportTime] = useState('');
  const [legRateType, setLegRateType] = useState<RateType>('FLAT_RATE');
  const [legBaseRate, setLegBaseRate] = useState('');
  
  // Search states
  const [carrierSearch, setCarrierSearch] = useState('');
  const [showCarrierDropdown, setShowCarrierDropdown] = useState(false);
  const [routeSearch, setRouteSearch] = useState('');
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);

  // Fetch carriers
  const { data: carriersData } = useQuery({
    queryKey: ['carriers'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('status', 'ACTIVE');
      params.append('limit', '5000');
      const response = await api.get(`/carriers?${params.toString()}`);
      return response.data;
    },
    enabled: isAuthenticated
  });

  // Fetch routes
  const { data: routesData } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '1500');
      const response = await api.get(`/routes?${params.toString()}`);
      return response.data;
    },
    enabled: isAuthenticated
  });

  // Fetch system settings for fuel surcharge rate
  const { data: settingsData } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    },
    enabled: isAuthenticated
  });

  const carriers = carriersData?.carriers || [];
  const routes = routesData?.routes || [];

  // Update fuel surcharge rate when settings data is loaded
  useEffect(() => {
    if (settingsData?.fuelSurchargeRate) {
      setFuelSurchargeRate(Number(settingsData.fuelSurchargeRate));
    }
  }, [settingsData]);

  // Filtered carriers
  const filteredCarriers = useMemo(() => {
    if (!carrierSearch.trim()) return [];
    return carriers.filter((carrier: any) =>
      carrier.name.toLowerCase().includes(carrierSearch.toLowerCase()) ||
      carrier.mcNumber?.toLowerCase().includes(carrierSearch.toLowerCase()) ||
      carrier.dotNumber?.toLowerCase().includes(carrierSearch.toLowerCase())
    ).slice(0, 10);
  }, [carriers, carrierSearch]);

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    if (!routeSearch.trim()) return [];
    return routes.filter((route: any) =>
      route.name.toLowerCase().includes(routeSearch.toLowerCase()) ||
      route.origin.toLowerCase().includes(routeSearch.toLowerCase()) ||
      route.destination.toLowerCase().includes(routeSearch.toLowerCase())
    ).slice(0, 10);
  }, [routes, routeSearch]);

  // Calculate report time (45 minutes before first leg departure)
  const calculateReportTime = (departureTime: string): string => {
    if (!departureTime) return '';
    
    try {
      // Parse the time string (HH:MM format)
      const [hours, minutes] = departureTime.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      
      // Subtract 45 minutes
      date.setMinutes(date.getMinutes() - 45);
      
      // Format back to HH:MM
      return date.toTimeString().slice(0, 5);
    } catch (error) {
      console.error('Error calculating report time:', error);
      return '';
    }
  };

  // Calculate arrival time based on mileage and departure time (assuming 60 mph average speed)
  const calculateArrivalTime = (departureTime: string, miles: number): string => {
    if (!departureTime || !miles || miles <= 0) return '';
    
    try {
      // Parse the time string (HH:MM format)
      const [hours, minutes] = departureTime.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      
      // Calculate travel time in hours (assuming 60 mph average speed)
      const travelTimeHours = miles / 60;
      
      // Add travel time
      date.setMinutes(date.getMinutes() + (travelTimeHours * 60));
      
      // Format back to HH:MM
      return date.toTimeString().slice(0, 5);
    } catch (error) {
      console.error('Error calculating arrival time:', error);
      return '';
    }
  };

  // Search for mileage between origin and destination in routes
  const findMileageInRoutes = (origin: string, destination: string): number | null => {
    if (!origin || !destination || !routes.length) return null;
    
    // Look for exact match in routes
    const matchingRoute = routes.find((route: any) => 
      route.origin.toLowerCase() === origin.toLowerCase() && 
      route.destination.toLowerCase() === destination.toLowerCase()
    );
    
    if (matchingRoute && matchingRoute.distance) {
      return parseFloat(matchingRoute.distance.toString());
    }
    
    return null;
  };

  // Find route information for origin/destination pair
  const findRouteInfo = (origin: string, destination: string): any | null => {
    if (!origin || !destination || !routes.length) return null;
    
    // Look for exact match in routes
    const matchingRoute = routes.find((route: any) => 
      route.origin.toLowerCase() === origin.toLowerCase() && 
      route.destination.toLowerCase() === destination.toLowerCase()
    );
    
    return matchingRoute || null;
  };

  // Calculate leg rate
  const calculateLegRate = () => {
    const miles = legType === 'route' 
      ? routes.find((r: any) => r.id.toString() === selectedRouteId)?.distance || 0
      : parseFloat(customMiles) || 0;
    
    const baseRate = parseFloat(legBaseRate) || 0;
    
    switch (legRateType) {
      case 'FLAT_RATE':
        return baseRate.toFixed(2);
      case 'MILE':
        return (baseRate * miles).toFixed(2);
      case 'MILE_FSC':
        const mileRate = baseRate * miles;
        const fscAmount = mileRate * (fuelSurchargeRate / 100);
        return (mileRate + fscAmount).toFixed(2);
      default:
        return '0.00';
    }
  };

  // Clear leg builder
  const clearLegBuilder = (keepRateSettings = false) => {
    // Keep rate type and base rate from previous leg if requested
    const keepRateType = keepRateSettings ? legRateType : 'FLAT_RATE';
    const keepBaseRate = keepRateSettings ? legBaseRate : '';
    
    if (keepRateSettings) {
      console.log('Keeping rate settings for next leg:', { rateType: keepRateType, baseRate: keepBaseRate });
    }
    
    setLegType('route');
    setSelectedRouteId('');
    setCustomOrigin('');
    setCustomDestination('');
    setCustomMiles('');
    setIsRoundTrip(false);
    setSelectedOriginLocation(null);
    setSelectedDestinationLocation(null);
    setLegDepartureTime('');
    setLegArrivalTime('');
    setLegReportTime('');
    setLegRateType(keepRateType);
    setLegBaseRate(keepBaseRate);
    setRouteSearch('');
  };

  // Add leg
  const addLeg = () => {
    // Validate base rate for both types
    if (!legBaseRate || parseFloat(legBaseRate) <= 0) {
      alert('Please enter a valid rate');
      return;
    }
    
    if (legType === 'route') {
      if (!selectedRouteId) {
        alert('Please select a route');
        return;
      }
      const route = routes.find((r: any) => r.id.toString() === selectedRouteId);
      if (!route) {
        alert('Selected route not found');
        return;
      }
      
      const newLeg: UnifiedLeg = {
        id: Date.now().toString(),
        type: 'route',
        routeId: selectedRouteId,
        routeName: route.name,
        origin: route.origin,
        destination: route.destination,
        miles: route.distance || 0,
        rateType: legRateType,
        baseRate: legBaseRate,
        totalRate: calculateLegRate(),
        departureTime: legDepartureTime || route.departureTime,
        arrivalTime: legArrivalTime || route.arrivalTime,
        reportTime: legReportTime
      };
      
      setLegs([...legs, newLeg]);
    } else {
      // Custom origin-destination
      if (!customOrigin || !customDestination || !customMiles) {
        alert('Please fill in origin, destination, and miles');
        return;
      }
      
      if (parseFloat(customMiles) <= 0) {
        alert('Please enter a valid number of miles');
        return;
      }
      
      const newLeg: UnifiedLeg = {
        id: Date.now().toString(),
        type: 'custom',
        origin: customOrigin,
        destination: customDestination,
        miles: parseFloat(customMiles),
        rateType: legRateType,
        baseRate: legBaseRate,
        totalRate: calculateLegRate(),
        departureTime: legDepartureTime,
        arrivalTime: legArrivalTime,
        reportTime: legReportTime,
        originLocation: selectedOriginLocation,
        destinationLocation: selectedDestinationLocation
      };
      
      // If round trip is checked, create both legs at once
      if (isRoundTrip) {
        const returnLeg: UnifiedLeg = {
          id: (Date.now() + 1).toString(), // Ensure unique ID
          type: 'custom',
          origin: customDestination, // Swapped: destination becomes origin
          destination: customOrigin, // Swapped: origin becomes destination  
          miles: parseFloat(customMiles), // Same miles for return trip
          rateType: legRateType,
          baseRate: legBaseRate,
          totalRate: calculateLegRate(),
          departureTime: '', // Leave empty for user to set
          arrivalTime: '', // Leave empty for user to set
          reportTime: '',
          originLocation: selectedDestinationLocation, // Swapped location objects
          destinationLocation: selectedOriginLocation // Swapped location objects
        };
        
        setLegs([...legs, newLeg, returnLeg]);
        console.log('Added round trip legs, total legs now:', legs.length + 2);
      } else {
        setLegs([...legs, newLeg]);
        console.log('Added single leg, total legs now:', legs.length + 1);
      }
    }
    
    clearLegBuilder(true); // Keep rate settings for next leg
    
    // Keep the leg builder visible so user can continue to booking form
  };

  // Remove leg
  const removeLeg = (legId: string) => {
    setLegs(legs.filter(leg => leg.id !== legId));
    // Always show the builder when removing legs
    setShowLegBuilder(true);
  };

  // Total calculations
  const totalMiles = legs.reduce((sum, leg) => sum + leg.miles, 0);
  const totalRate = legs.reduce((sum, leg) => sum + parseFloat(leg.totalRate), 0);

  // Auto-calculate carrier report time based on first leg departure time
  useEffect(() => {
    if (legs.length > 0 && legs[0].departureTime) {
      const firstLegDeparture = legs[0].departureTime;
      const calculatedReportTime = calculateReportTime(firstLegDeparture);
      setCarrierReportTime(calculatedReportTime);
    }
  }, [legs]);

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookings: any[]) => {
      const response = await api.post('/bookings', bookings);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate('/bookings');
    },
    onError: (error: any) => {
      console.error('Booking creation error:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.message || error.response?.data?.error || 'Failed to create booking');
    }
  });

  // Check if there are unsaved changes in the leg builder
  const hasUnsavedLegData = () => {
    if (legType === 'route') {
      return selectedRouteId && legBaseRate;
    } else {
      return customOrigin && customDestination && customMiles && legBaseRate;
    }
  };

  // Handle create booking
  const handleCreateBooking = () => {
    // Check for unsaved leg data
    if (hasUnsavedLegData()) {
      const confirmMessage = 'You have unsaved leg data. Click "Add Leg" to save it first, or proceed without this leg?';
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }
    
    // Validation
    if (legs.length === 0) {
      alert('Please add at least one leg to the booking');
      return;
    }

    // Get booking dates
    const dates = useMultipleDates
      ? eachDayOfInterval({
          start: parseISO(bookingDate),
          end: parseISO(endDate)
        }).map(date => format(date, 'yyyy-MM-dd'))
      : [bookingDate];

    // Create bookings
    const bookingsToCreate: any[] = [];
    
    dates.forEach(date => {
      // Calculate total rate for all legs
      const totalRate = legs.reduce((sum, leg) => sum + parseFloat(leg.totalRate), 0);
      
      // For multi-leg bookings, create one booking with leg information in notes
      let bookingNotes = '';
      if (legs.length > 1) {
        bookingNotes = '--- Multi-Leg Booking ---\n';
        legs.forEach((leg, index) => {
          bookingNotes += `Leg ${index + 1}: ${leg.origin} → ${leg.destination} ($${leg.totalRate})\n`;
        });
        if (notes) {
          bookingNotes += '\n' + notes;
        }
      } else {
        bookingNotes = notes || '';
      }

      const firstLeg = legs[0];
      const bookingData: any = {
        carrierId: carrierId ? parseInt(carrierId) : null,
        bookingDate: date,
        billable: true,
        type: bookingType,
        trailerLength: bookingType === 'POWER_AND_TRAILER' && trailerLength ? parseInt(trailerLength) : null,
        status: carrierId ? 'CONFIRMED' : 'PENDING',
        rate: totalRate.toFixed(2),
        rateType: firstLeg.rateType,
        baseRate: firstLeg.baseRate,
        fscRate: firstLeg.rateType === 'MILE_FSC' ? fuelSurchargeRate : undefined,
        driverName: driverName || undefined,
        phoneNumber: phoneNumber || undefined,
        carrierEmail: carrierEmail || undefined,
        carrierReportTime: firstLeg.reportTime || carrierReportTime || undefined,
        departureTime: firstLeg.departureTime || undefined,
        arrivalTime: legs[legs.length - 1].arrivalTime || undefined, // Use last leg's arrival time
        notes: bookingNotes
      };
      
      if (firstLeg.type === 'route' && legs.length === 1) {
        // Single route booking
        bookingData.routeId = parseInt(firstLeg.routeId!);
      } else {
        // Custom origin/destination booking or multi-leg
        bookingData.routeId = null;
        bookingData.origin = firstLeg.origin;
        bookingData.destination = legs[legs.length - 1].destination; // Final destination
        bookingData.estimatedMiles = legs.reduce((sum, leg) => sum + leg.miles, 0); // Total miles
        
        // For custom bookings, use location data or try route information fallback
        if (firstLeg.type === 'custom') {
          // Use selected location data if available (new approach)
          if (firstLeg.originLocation) {
            bookingData.originAddress = firstLeg.originLocation.address;
            bookingData.originCity = firstLeg.originLocation.city;
            bookingData.originState = firstLeg.originLocation.state;
            bookingData.originZipCode = firstLeg.originLocation.zipCode;
            bookingData.originContact = firstLeg.originLocation.contact;
            bookingData.originTimeZone = firstLeg.originLocation.timeZone;
            bookingData.originLatitude = firstLeg.originLocation.latitude;
            bookingData.originLongitude = firstLeg.originLocation.longitude;
          }
          
          const lastLeg = legs[legs.length - 1];
          if (lastLeg.destinationLocation) {
            bookingData.destinationAddress = lastLeg.destinationLocation.address;
            bookingData.destinationCity = lastLeg.destinationLocation.city;
            bookingData.destinationState = lastLeg.destinationLocation.state;
            bookingData.destinationZipCode = lastLeg.destinationLocation.zipCode;
            bookingData.destinationContact = lastLeg.destinationLocation.contact;
            bookingData.destinationTimeZone = lastLeg.destinationLocation.timeZone;
            bookingData.destinationLatitude = lastLeg.destinationLocation.latitude;
            bookingData.destinationLongitude = lastLeg.destinationLocation.longitude;
          }
          
          // Fallback: try to find route information if location data is not available
          if (legs.length === 1 && (!firstLeg.originLocation || !firstLeg.destinationLocation)) {
            const routeInfo = findRouteInfo(firstLeg.origin, firstLeg.destination);
            if (routeInfo) {
              // Populate route information fields and missing location data
              bookingData.routeFrequency = routeInfo.frequency;
              bookingData.routeStandardRate = routeInfo.standardRate;
              bookingData.routeRunTime = routeInfo.runTime;
              
              // Only use route data if location data is missing
              if (!firstLeg.originLocation) {
                bookingData.originAddress = routeInfo.originAddress;
                bookingData.originCity = routeInfo.originCity;
                bookingData.originState = routeInfo.originState;
                bookingData.originZipCode = routeInfo.originZipCode;
                bookingData.originContact = routeInfo.originContact;
                bookingData.originTimeZone = routeInfo.originTimeZone;
                bookingData.originLatitude = routeInfo.originLatitude;
                bookingData.originLongitude = routeInfo.originLongitude;
              }
              
              if (!firstLeg.destinationLocation) {
                bookingData.destinationAddress = routeInfo.destinationAddress;
                bookingData.destinationCity = routeInfo.destinationCity;
                bookingData.destinationState = routeInfo.destinationState;
                bookingData.destinationZipCode = routeInfo.destinationZipCode;
                bookingData.destinationContact = routeInfo.destinationContact;
                bookingData.destinationTimeZone = routeInfo.destinationTimeZone;
                bookingData.destinationLatitude = routeInfo.destinationLatitude;
                bookingData.destinationLongitude = routeInfo.destinationLongitude;
              }
            }
          }
        }
      }
      
      // Clean up undefined values
      Object.keys(bookingData).forEach(key => {
        if (bookingData[key] === undefined) {
          delete bookingData[key];
        }
      });
      
      bookingsToCreate.push(bookingData);
    });

    console.log('Creating bookings with data:', JSON.stringify(bookingsToCreate, null, 2));
    createBookingMutation.mutate(bookingsToCreate);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Booking</h1>

      {/* Basic Info Section */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Basic Information</h2>
        

        {/* Carrier Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Truck className="inline w-4 h-4 mr-1" />
            Carrier
          </label>
          <div className="relative">
            <input
              type="text"
              value={carrierSearch}
              onChange={(e) => {
                setCarrierSearch(e.target.value);
                setShowCarrierDropdown(true);
              }}
              onFocus={() => setShowCarrierDropdown(true)}
              onBlur={() => setTimeout(() => setShowCarrierDropdown(false), 200)}
              placeholder="Search carriers..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            {showCarrierDropdown && filteredCarriers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredCarriers.map((carrier: any) => (
                  <button
                    key={carrier.id}
                    type="button"
                    onClick={() => {
                      setCarrierId(carrier.id.toString());
                      setCarrierSearch(carrier.name);
                      setShowCarrierDropdown(false);
                      // Auto-populate carrier email if available
                      if (carrier.email) {
                        setCarrierEmail(carrier.email);
                      }
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100"
                  >
                    <div className="font-medium">{carrier.name}</div>
                    <div className="text-xs text-gray-500">
                      MC: {carrier.mcNumber} | DOT: {carrier.dotNumber}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Booking Date
            </label>
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          
          <div className="flex items-end gap-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useMultipleDates}
                onChange={(e) => setUseMultipleDates(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Multiple dates</span>
            </label>
            {useMultipleDates && (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={bookingDate}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
            )}
          </div>
        </div>

        {/* Power Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Power Type</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="POWER_ONLY"
                checked={bookingType === 'POWER_ONLY'}
                onChange={(e) => setBookingType(e.target.value as 'POWER_ONLY' | 'POWER_AND_TRAILER')}
                className="mr-2"
              />
              <span>Power Only</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="POWER_AND_TRAILER"
                checked={bookingType === 'POWER_AND_TRAILER'}
                onChange={(e) => setBookingType(e.target.value as 'POWER_ONLY' | 'POWER_AND_TRAILER')}
                className="mr-2"
              />
              <span>Power and Trailer</span>
            </label>
          </div>
          {bookingType === 'POWER_AND_TRAILER' && (
            <input
              type="number"
              value={trailerLength}
              onChange={(e) => setTrailerLength(e.target.value)}
              placeholder="Trailer length (feet)"
              className="mt-2 px-3 py-2 border border-gray-300 rounded-md"
            />
          )}
        </div>
      </div>

      {/* Leg Builder Section */}
      {showLegBuilder && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              {legs.length === 0 ? 'Booking Details' : `Add Leg ${legs.length + 1}`}
            </h2>
            {hasUnsavedLegData() && (
              <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-md">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Unsaved changes</span>
              </div>
            )}
          </div>
          
          {/* Leg Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Leg Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={legType === 'route'}
                  onChange={() => setLegType('route')}
                  className="mr-2"
                />
                <span>Predefined Route</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={legType === 'custom'}
                  onChange={() => setLegType('custom')}
                  className="mr-2"
                />
                <span>Custom Origin → Destination</span>
              </label>
            </div>
          </div>

          {/* Route Selection */}
          {legType === 'route' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                Select Route
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={routeSearch}
                  onChange={(e) => {
                    setRouteSearch(e.target.value);
                    setShowRouteDropdown(true);
                  }}
                  onFocus={() => setShowRouteDropdown(true)}
                  onBlur={() => setTimeout(() => setShowRouteDropdown(false), 200)}
                  placeholder="Search routes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {showRouteDropdown && filteredRoutes.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredRoutes.map((route: any) => (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => {
                          setSelectedRouteId(route.id.toString());
                          setRouteSearch(`${route.name} (${route.origin} → ${route.destination})`);
                          setShowRouteDropdown(false);
                          // Auto-populate departure and arrival times from route
                          if (route.departureTime) {
                            setLegDepartureTime(route.departureTime);
                          }
                          if (route.arrivalTime) {
                            setLegArrivalTime(route.arrivalTime);
                          }
                          // Auto-calculate report time (45 minutes before departure)
                          if (route.departureTime) {
                            setLegReportTime(calculateReportTime(route.departureTime));
                          }
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100"
                      >
                        <div className="font-medium">{route.name}</div>
                        <div className="text-xs text-gray-500">
                          {route.origin} → {route.destination} • {route.distance} miles
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Origin</label>
                  <LocationAutocomplete
                    value={customOrigin}
                    onChange={(value) => {
                      setCustomOrigin(value);
                      // Auto-populate mileage when both origin and destination are set
                      if (value && customDestination) {
                        const foundMileage = findMileageInRoutes(value, customDestination);
                        if (foundMileage) {
                          setCustomMiles(foundMileage.toString());
                          // Auto-calculate arrival time if departure time is set
                          if (legDepartureTime) {
                            setLegArrivalTime(calculateArrivalTime(legDepartureTime, foundMileage));
                          }
                        }
                      }
                    }}
                    onLocationSelect={(location) => {
                      setSelectedOriginLocation(location);
                    }}
                    placeholder="Search origin..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                  <LocationAutocomplete
                    value={customDestination}
                    onChange={(value) => {
                      setCustomDestination(value);
                      // Auto-populate mileage when both origin and destination are set
                      if (customOrigin && value) {
                        const foundMileage = findMileageInRoutes(customOrigin, value);
                        if (foundMileage) {
                          setCustomMiles(foundMileage.toString());
                          // Auto-calculate arrival time if departure time is set
                          if (legDepartureTime) {
                            setLegArrivalTime(calculateArrivalTime(legDepartureTime, foundMileage));
                          }
                        }
                      }
                    }}
                    onLocationSelect={(location) => {
                      setSelectedDestinationLocation(location);
                    }}
                    placeholder="Search destination..."
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Miles
                  <span className="text-xs text-gray-500 ml-1">(auto-populated from routes if available)</span>
                </label>
                <input
                  type="number"
                  value={customMiles}
                  onChange={(e) => {
                    setCustomMiles(e.target.value);
                    // Auto-calculate arrival time when miles change
                    if (legDepartureTime && e.target.value) {
                      const miles = parseFloat(e.target.value);
                      if (miles > 0) {
                        setLegArrivalTime(calculateArrivalTime(legDepartureTime, miles));
                      }
                    }
                  }}
                  placeholder="Enter miles or auto-populated from routes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="1"
                  step="0.1"
                />
              </div>
              
              {/* Round Trip Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="roundTrip"
                  checked={isRoundTrip}
                  onChange={(e) => setIsRoundTrip(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="roundTrip" className="text-sm font-medium text-gray-700">
                  Check for Round Trip
                  <span className="text-xs text-gray-500 ml-1">(automatically creates return leg)</span>
                </label>
              </div>
            </div>
          )}

          {/* Rate Configuration */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Rate Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rate Type</label>
                <select
                  value={legRateType}
                  onChange={(e) => setLegRateType(e.target.value as RateType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="FLAT_RATE">Flat Rate</option>
                  <option value="MILE">Per Mile</option>
                  <option value="MILE_FSC">Per Mile + FSC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {legRateType === 'FLAT_RATE' ? 'Rate' : 'Rate per Mile'}
                </label>
                <input
                  type="number"
                  value={legBaseRate}
                  onChange={(e) => setLegBaseRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Rate</label>
                <input
                  type="text"
                  value={`$${calculateLegRate()}`}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Departure and Arrival Times */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Departure Time</label>
                <input
                  type="time"
                  value={legDepartureTime}
                  onChange={(e) => {
                    setLegDepartureTime(e.target.value);
                    // Auto-calculate report time when departure time changes
                    if (e.target.value) {
                      setLegReportTime(calculateReportTime(e.target.value));
                    }
                    // Auto-calculate arrival time based on mileage
                    if (e.target.value && customMiles) {
                      const miles = parseFloat(customMiles);
                      if (miles > 0) {
                        setLegArrivalTime(calculateArrivalTime(e.target.value, miles));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arrival Time
                  <span className="text-xs text-gray-500 ml-1">(auto-calculated from departure time and mileage)</span>
                </label>
                <input
                  type="time"
                  value={legArrivalTime}
                  onChange={(e) => setLegArrivalTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Report Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Time 
              <span className="text-xs text-gray-500 ml-1">(auto-calculated as 45 min before departure)</span>
            </label>
            <input
              type="time"
              value={legReportTime}
              onChange={(e) => setLegReportTime(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Add Leg Button */}
          <div className="flex justify-end">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addLeg}
                disabled={!legBaseRate || (legType === 'route' ? !selectedRouteId : (!customOrigin || !customDestination || !customMiles))}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legs Summary */}
      {legs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Booking Summary</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Leg</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Miles</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Depart</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Arrive</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {legs.map((leg, index) => (
                  <tr key={leg.id}>
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        leg.type === 'route' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {leg.type === 'route' ? 'Route' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-sm">
                          {leg.type === 'route' ? leg.routeName : `${leg.origin} → ${leg.destination}`}
                        </div>
                        {leg.type === 'custom' && (
                          <div className="text-xs text-gray-500">{leg.origin} → {leg.destination}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{leg.miles}</td>
                    <td className="px-4 py-3">{leg.departureTime || '-'}</td>
                    <td className="px-4 py-3">{leg.arrivalTime || '-'}</td>
                    <td className="px-4 py-3">{leg.rateType}</td>
                    <td className="px-4 py-3">${leg.totalRate}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeLeg(leg.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-medium">Total</td>
                  <td className="px-4 py-3 font-medium">{totalMiles}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 font-medium">${totalRate.toFixed(2)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Additional Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Driver Name</label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Carrier Email</label>
            <input
              type="email"
              value={carrierEmail}
              onChange={(e) => setCarrierEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate('/bookings')}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreateBooking}
          disabled={legs.length === 0 || createBookingMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {createBookingMutation.isPending ? 'Creating...' : 'Create Booking'}
        </button>
      </div>
    </div>
  );
};