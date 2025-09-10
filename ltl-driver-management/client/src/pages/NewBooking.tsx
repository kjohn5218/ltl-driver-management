import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Carrier, Route } from '../types';
import { Calendar, Truck, MapPin, DollarSign, AlertCircle, Search, X } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { LocationWithTooltip } from '../components/LocationDisplay';

type RateType = 'MILE' | 'MILE_FSC' | 'FLAT_RATE';

interface BookingLeg {
  id: string;
  routeId: string;
  rate: string;
  rateType: RateType;
  baseRate?: string; // For Mile and Mile+FSC types
  route?: Route;
}

export const NewBooking: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [carrierId, setCarrierId] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [bookingLegs, setBookingLegs] = useState<BookingLeg[]>([]);
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [useMultipleDates, setUseMultipleDates] = useState(false);
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [driverName, setDriverName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [carrierEmail, setCarrierEmail] = useState('');
  const [carrierReportTime, setCarrierReportTime] = useState('');
  const [billable, setBillable] = useState(true);
  const [bookingType, setBookingType] = useState<'POWER_ONLY' | 'POWER_AND_TRAILER'>('POWER_ONLY');
  const [trailerLength, setTrailerLength] = useState('');
  const [singleRouteRateType, setSingleRouteRateType] = useState<RateType>('FLAT_RATE');
  const [singleRouteBaseRate, setSingleRouteBaseRate] = useState('');
  const [carrierSearch, setCarrierSearch] = useState('');
  const [showCarrierDropdown, setShowCarrierDropdown] = useState(false);
  const [selectedCarrierName, setSelectedCarrierName] = useState('');
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [selectedRouteName, setSelectedRouteName] = useState('');
  const [routeSearchInput, setRouteSearchInput] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [originSearchInput, setOriginSearchInput] = useState('');
  const [destinationSearchInput, setDestinationSearchInput] = useState('');
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [fuelSurchargeRate, setFuelSurchargeRate] = useState<number>(0);

  // Fetch carriers
  const { data: carriersData, isLoading: loadingCarriers } = useQuery({
    queryKey: ['carriers'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('status', 'ACTIVE');
      params.append('limit', '5000'); // Fetch all active carriers
      
      const response = await api.get(`/carriers?${params.toString()}`);
      return response.data;
    }
  });

  // Fetch routes
  const { data: routesData, isLoading: loadingRoutes } = useQuery({
    queryKey: ['routes', originFilter, destinationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '1500');
      if (originFilter.trim()) params.append('origin', originFilter.trim());
      if (destinationFilter.trim()) params.append('destination', destinationFilter.trim());
      
      const response = await api.get(`/routes?${params.toString()}`);
      return response.data;
    }
  });

  const carriers = carriersData?.carriers || [];
  const routes = routesData?.routes || [];

  // Fetch system settings for fuel surcharge
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    }
  });

  // Update fuel surcharge rate when settings load
  React.useEffect(() => {
    const rate = settingsData?.fuelSurchargeRate;
    const numericRate = Number(rate);
    setFuelSurchargeRate(isNaN(numericRate) ? 0 : numericRate);
  }, [settingsData]);

  // Get unique origins and destinations for filter dropdowns
  const uniqueOrigins = [...new Set(routes.map((r: Route) => r.origin))].sort();
  const uniqueDestinations = [...new Set(routes.map((r: Route) => r.destination))].sort();

  const selectedCarrier = carriers.find((c: Carrier) => c.id.toString() === carrierId);

  // Filter carriers based on search term
  const filteredCarriers = useMemo(() => {
    if (!carriers.length) return [];
    
    return carriers.filter((carrier: Carrier) =>
      carrier.name.toLowerCase().includes(carrierSearch.toLowerCase()) ||
      carrier.mcNumber?.toLowerCase().includes(carrierSearch.toLowerCase()) ||
      carrier.dotNumber?.toLowerCase().includes(carrierSearch.toLowerCase())
    ).slice(0, 10); // Limit to first 10 results
  }, [carriers, carrierSearch]);

  // Handle carrier selection
  const handleCarrierSelect = (carrier: Carrier) => {
    setCarrierId(carrier.id.toString());
    setSelectedCarrierName(carrier.name);
    setCarrierEmail(carrier.email || ''); // Populate carrier email if available
    setCarrierSearch('');
    setShowCarrierDropdown(false);
    calculateSuggestedRate();
  };

  // Calculate carrier report time (45 minutes before route departure time)
  const calculateCarrierReportTime = (departureTime: string | undefined): string => {
    if (!departureTime) return '';
    
    try {
      // Parse the departure time (format: "HH:mm:ss" or "HH:mm")
      const [hours, minutes] = departureTime.split(':').map(Number);
      
      // Create a date object for today with the departure time
      const departureDate = new Date();
      departureDate.setHours(hours, minutes, 0, 0);
      
      // Subtract 45 minutes
      const reportDate = new Date(departureDate.getTime() - 45 * 60 * 1000);
      
      // Format as HH:mm
      return reportDate.toTimeString().slice(0, 5);
    } catch (error) {
      console.error('Error calculating carrier report time:', error);
      return '';
    }
  };

  // Handle carrier search input
  const handleCarrierSearch = (value: string) => {
    setCarrierSearch(value);
    setShowCarrierDropdown(value.length > 0);
    if (value.length === 0) {
      setSelectedCarrierName('');
      setCarrierId('');
      setCarrierEmail('');
    }
  };

  // Clear carrier selection
  const clearCarrierSelection = () => {
    setCarrierId('');
    setSelectedCarrierName('');
    setCarrierEmail('');
    setCarrierSearch('');
    setShowCarrierDropdown(false);
  };

  // Filter routes based on search term (for single route selection)
  const filteredRoutes = useMemo(() => {
    if (!routes.length) return [];
    
    return routes.filter((route: Route) =>
      route.name.toLowerCase().includes(routeSearchInput.toLowerCase()) ||
      route.origin.toLowerCase().includes(routeSearchInput.toLowerCase()) ||
      route.destination.toLowerCase().includes(routeSearchInput.toLowerCase())
    ).slice(0, 10); // Limit to first 10 results
  }, [routes, routeSearchInput]);

  // Filter routes for multi-leg selection (exclude already selected)
  const filteredMultiRoutes = useMemo(() => {
    if (!routes.length) return [];
    
    const availableRoutes = routes.filter(route => !bookingLegs.find(leg => leg.routeId === route.id.toString()));
    
    return availableRoutes.filter((route: Route) =>
      route.name.toLowerCase().includes(routeSearchInput.toLowerCase()) ||
      route.origin.toLowerCase().includes(routeSearchInput.toLowerCase()) ||
      route.destination.toLowerCase().includes(routeSearchInput.toLowerCase())
    ).slice(0, 10); // Limit to first 10 results
  }, [routes, routeSearchInput, bookingLegs]);

  // Handle single route selection
  const handleSingleRouteSelect = (route: Route) => {
    setSelectedRoutes([route.id.toString()]);
    setSelectedRouteName(`${route.name} (${route.origin} → ${route.destination})`);
    setRouteSearchInput('');
    setShowRouteDropdown(false);
    
    // Calculate and set carrier report time
    const reportTime = calculateCarrierReportTime(route.departureTime);
    setCarrierReportTime(reportTime);
    
    calculateSuggestedRate();
  };

  // Handle multi route selection
  const handleMultiRouteSelect = (route: Route) => {
    addRoute(route.id.toString());
    setRouteSearchInput('');
    setShowRouteDropdown(false);
  };

  // Handle route search input
  const handleRouteSearch = (value: string) => {
    setRouteSearchInput(value);
    setShowRouteDropdown(value.length > 0);
    if (value.length === 0) {
      setSelectedRouteName('');
      if (!isRoundTrip) {
        setSelectedRoutes([]);
      }
    }
  };

  // Clear single route selection
  const clearSingleRouteSelection = () => {
    setSelectedRoutes([]);
    setSelectedRouteName('');
    setRouteSearchInput('');
    setShowRouteDropdown(false);
  };

  // Filter origins based on search term
  const filteredOrigins = useMemo(() => {
    return uniqueOrigins.filter(origin =>
      origin.toLowerCase().includes(originSearchInput.toLowerCase())
    ).slice(0, 10); // Limit to first 10 results
  }, [uniqueOrigins, originSearchInput]);

  // Filter destinations based on search term
  const filteredDestinations = useMemo(() => {
    return uniqueDestinations.filter(destination =>
      destination.toLowerCase().includes(destinationSearchInput.toLowerCase())
    ).slice(0, 10); // Limit to first 10 results
  }, [uniqueDestinations, destinationSearchInput]);

  // Handle origin search and selection
  const handleOriginSearch = (value: string) => {
    setOriginSearchInput(value);
    setShowOriginDropdown(value.length > 0);
    if (value.length === 0) {
      setOriginFilter('');
    }
  };

  const handleOriginSelect = (origin: string) => {
    setOriginFilter(origin);
    setOriginSearchInput('');
    setShowOriginDropdown(false);
  };

  const clearOriginSelection = () => {
    setOriginFilter('');
    setOriginSearchInput('');
    setShowOriginDropdown(false);
  };

  // Handle destination search and selection
  const handleDestinationSearch = (value: string) => {
    setDestinationSearchInput(value);
    setShowDestinationDropdown(value.length > 0);
    if (value.length === 0) {
      setDestinationFilter('');
    }
  };

  const handleDestinationSelect = (destination: string) => {
    setDestinationFilter(destination);
    setDestinationSearchInput('');
    setShowDestinationDropdown(false);
  };

  const clearDestinationSelection = () => {
    setDestinationFilter('');
    setDestinationSearchInput('');
    setShowDestinationDropdown(false);
  };

  const selectedRouteObjects = routes.filter((r: Route) => selectedRoutes.includes(r.id.toString()));

  // Generate array of dates for multiple date booking
  const getBookingDates = (): string[] => {
    if (!useMultipleDates) {
      return [bookingDate];
    }
    
    const start = parseISO(bookingDate);
    const end = parseISO(endDate);
    const dates = eachDayOfInterval({ start, end });
    
    return dates.map(date => format(date, 'yyyy-MM-dd'));
  };

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingsToCreate: any[]) => {
      console.log(`Creating ${bookingsToCreate.length} booking(s)`);
      const results = [];
      for (const bookingData of bookingsToCreate) {
        console.log('Sending booking data:', bookingData);
        const response = await api.post('/bookings', bookingData);
        results.push(response.data);
      }
      return results;
    },
    onSuccess: (results) => {
      // Invalidate bookings query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate('/bookings');
    },
    onError: (error: any) => {
      console.error('Booking creation error:', error);
      console.error('Error response:', error.response?.data);
      
      // Log the errors array in detail
      if (error.response?.data?.errors) {
        console.error('Validation errors detail:', JSON.stringify(error.response.data.errors, null, 2));
      }
      
      let errorMessage = 'Failed to create booking';
      
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
        
        if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          const validationErrors = error.response.data.errors
            .map((err: any) => `${err.path || err.param}: ${err.msg}`)
            .join('\n');
          errorMessage += '\n\nValidation Errors:\n' + validationErrors;
        }
      }
      
      alert(`Error creating booking:\n${errorMessage}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bookingDate) {
      alert('Please select a booking date');
      return;
    }

    if (useMultipleDates && !endDate) {
      alert('Please select an end date');
      return;
    }

    if (useMultipleDates && new Date(endDate) < new Date(bookingDate)) {
      alert('End date must be after or equal to start date');
      return;
    }

    // Validate selected routes
    if (!isRoundTrip && selectedRoutes.length === 0) {
      alert('Please select a route');
      return;
    }

    if (isRoundTrip) {
      // Multi-leg booking validation
      if (bookingLegs.length === 0) {
        alert('Please add at least one route for the multi-leg booking');
        return;
      }
      
      // Validate that all legs have rates
      const invalidLegs = bookingLegs.filter(leg => !leg.rate || parseFloat(leg.rate) <= 0);
      if (invalidLegs.length > 0) {
        alert('Please ensure all legs have valid rates');
        return;
      }

      // Create consolidated multi-leg booking(s)
      // Calculate total rate across all legs and determine predominant rate type
      let totalRate = 0;
      const legDetails: string[] = [];
      const rateTypeCounts: Record<string, number> = {};
      let totalMiles = 0;
      let calculatedBaseRate = 0;
      
      bookingLegs.forEach((leg, index) => {
        const legRate = parseFloat(leg.rate);
        totalRate += legRate;
        
        // Count rate types to determine predominant type
        rateTypeCounts[leg.rateType] = (rateTypeCounts[leg.rateType] || 0) + 1;
        
        // Calculate weighted average base rate for mile-based legs
        if (leg.rateType !== 'FLAT_RATE' && leg.route?.distance) {
          const legMiles = parseFloat(leg.route.distance.toString());
          totalMiles += legMiles;
          if (leg.baseRate) {
            calculatedBaseRate += parseFloat(leg.baseRate) * legMiles;
          }
        }
        
        // Build leg description
        const route = leg.route;
        if (route) {
          legDetails.push(`Leg ${index + 1}: ${route.origin} → ${route.destination} ($${legRate.toFixed(2)})`);
        }
      });
      
      // Determine the predominant rate type
      const predominantRateType = Object.keys(rateTypeCounts).reduce((a, b) => 
        rateTypeCounts[a] > rateTypeCounts[b] ? a : b
      );
      
      // Calculate weighted average base rate if applicable
      const averageBaseRate = totalMiles > 0 ? calculatedBaseRate / totalMiles : totalRate;
      
      // Use the first route as the primary route (for database constraint)
      const primaryRouteId = bookingLegs[0].routeId;
      
      // Get all booking dates
      const dates = getBookingDates();
      
      // Create booking data for each date
      const bookingsToCreate = dates.map((date) => {
        // Combine notes with leg details
        const combinedNotes = [
          notes ? notes : null,
          useMultipleDates ? `--- Multi-Leg Booking (${format(parseISO(date), 'MMM dd, yyyy')}) ---` : '--- Multi-Leg Booking ---',
          ...legDetails,
          `Total: $${totalRate.toFixed(2)}`
        ].filter(Boolean).join('\n');
        
        const bookingData: any = {
          carrierId: carrierId ? parseInt(carrierId) : null,
          routeId: parseInt(primaryRouteId),
          bookingDate: date,
          rate: totalRate.toFixed(2),
          rateType: predominantRateType, // Use predominant rate type from legs
          baseRate: predominantRateType === 'FLAT_RATE' ? totalRate.toFixed(2) : averageBaseRate.toFixed(2),
          fscRate: predominantRateType === 'MILE_FSC' ? settingsData?.fuelSurchargeRate || 0 : null,
          billable,
          notes: combinedNotes,
          driverName: driverName || undefined,
          phoneNumber: phoneNumber || undefined,
          carrierEmail: carrierEmail || undefined,
          carrierReportTime: carrierReportTime || undefined,
          type: bookingType,
          trailerLength: bookingType === 'POWER_AND_TRAILER' && trailerLength ? parseInt(trailerLength) : null,
          status: carrierId ? 'CONFIRMED' : 'PENDING',
          legNumber: 1,
          isParent: true
        };
        
        // Remove null values that should be omitted
        Object.keys(bookingData).forEach(key => {
          if (bookingData[key] === null && key !== 'carrierId' && key !== 'notes' && key !== 'trailerLength') {
            delete bookingData[key];
          }
        });
        
        return bookingData;
      });
      
      console.log(`Creating ${bookingsToCreate.length} multi-leg booking(s)`);
      createBookingMutation.mutate(bookingsToCreate);
    } else {
      // Single route booking validation
      if (selectedRoutes.length === 0) {
        alert('Please select a route');
        return;
      }
      
      if (!singleRouteBaseRate || parseFloat(singleRouteBaseRate) <= 0) {
        alert('Please enter a valid rate');
        return;
      }
      
      if (!rate || parseFloat(rate) <= 0) {
        alert('Invalid calculated rate. Please check your inputs.');
        return;
      }

      // Get all booking dates
      const dates = getBookingDates();
      
      // Create booking data for each date
      const bookingsToCreate = dates.map((date) => {
        // Add date info to notes if multiple dates
        const dateNotes = useMultipleDates && notes ? 
          `${notes}\n\n[Booking Date: ${format(parseISO(date), 'MMM dd, yyyy')}]` : 
          (notes || null);
        
        const bookingData: any = {
          carrierId: carrierId ? parseInt(carrierId) : null,
          routeId: parseInt(selectedRoutes[0]),
          bookingDate: date,
          rate: parseFloat(rate).toFixed(2),
          rateType: singleRouteRateType,
          baseRate: singleRouteRateType === 'FLAT_RATE' 
            ? parseFloat(rate).toFixed(2) 
            : parseFloat(singleRouteBaseRate).toFixed(2),
          fscRate: singleRouteRateType === 'MILE_FSC' ? fuelSurchargeRate.toFixed(2) : undefined,
          billable,
          notes: dateNotes,
          driverName: driverName || undefined,
          phoneNumber: phoneNumber || undefined,
          carrierEmail: carrierEmail || undefined,
          carrierReportTime: carrierReportTime || undefined,
          type: bookingType,
          trailerLength: bookingType === 'POWER_AND_TRAILER' && trailerLength ? parseInt(trailerLength) : null,
          status: carrierId ? 'CONFIRMED' : 'PENDING',
          legNumber: 1,
          isParent: true
        };
        
        // Remove null values that should be omitted
        Object.keys(bookingData).forEach(key => {
          if (bookingData[key] === null && key !== 'carrierId' && key !== 'notes' && key !== 'trailerLength') {
            delete bookingData[key];
          }
        });
        
        return bookingData;
      });
      
      console.log(`Creating ${bookingsToCreate.length} single route booking(s)`);
      createBookingMutation.mutate(bookingsToCreate);
    }
  };

  const calculateSuggestedRate = () => {
    if (selectedRouteObjects.length > 0) {
      let totalRate = 0;
      
      selectedRouteObjects.forEach(route => {
        // If carrier has a rate per mile and route has miles
        if (selectedCarrier && selectedCarrier.ratePerMile && route.distance) {
          totalRate += parseFloat(selectedCarrier.ratePerMile.toString()) * parseFloat(route.distance.toString());
        } else if (route.standardRate) {
          // Use route's standard rate as fallback
          totalRate += parseFloat(route.standardRate.toString());
        }
      });
      
      if (totalRate > 0) {
        setRate(totalRate.toFixed(2));
      }
    }
  };

  // Calculate single route rate based on rate type
  const calculateSingleRouteRate = (): string => {
    if (!selectedRouteObjects.length) return '0.00';
    
    const route = selectedRouteObjects[0];
    const baseRateNum = parseFloat(singleRouteBaseRate) || 0;
    
    if (singleRouteRateType === 'FLAT_RATE') {
      return singleRouteBaseRate || '0.00';
    }
    
    const calculatedRate = calculateLegRate(route, singleRouteRateType, baseRateNum);
    return calculatedRate.toFixed(2);
  };

  // Update rate when base rate or type changes for single route
  React.useEffect(() => {
    if (!isRoundTrip && selectedRouteObjects.length > 0) {
      const newRate = calculateSingleRouteRate();
      setRate(newRate);
    }
  }, [singleRouteRateType, singleRouteBaseRate, selectedRouteObjects, isRoundTrip]);

  // Booking leg management functions
  const addBookingLeg = (routeId: string) => {
    if (isRoundTrip) {
      // For multi-leg bookings, add to legs array
      const route = routes.find((r: Route) => r.id.toString() === routeId);
      if (route && !bookingLegs.find(leg => leg.routeId === routeId)) {
        const defaultRateType: RateType = 'MILE';
        const suggestedRate = calculateLegRate(route, defaultRateType);
        const newLeg: BookingLeg = {
          id: Date.now().toString(), // Temporary ID
          routeId: routeId,
          rate: suggestedRate.toString(),
          rateType: defaultRateType,
          route: route
        };
        setBookingLegs([...bookingLegs, newLeg]);
      }
    } else {
      // For single route, use existing logic
      if (!selectedRoutes.includes(routeId)) {
        setSelectedRoutes([routeId]);
        calculateSuggestedRate();
      }
    }
  };

  const removeBookingLeg = (legId: string) => {
    setBookingLegs(bookingLegs.filter(leg => leg.id !== legId));
  };

  const updateLegRate = (legId: string, newRate: string) => {
    setBookingLegs(bookingLegs.map(leg => 
      leg.id === legId ? { ...leg, rate: newRate } : leg
    ));
  };

  const updateLegRateType = (legId: string, newRateType: RateType) => {
    setBookingLegs(bookingLegs.map(leg => {
      if (leg.id === legId) {
        const updatedLeg = { ...leg, rateType: newRateType };
        
        // Recalculate rate based on new type
        if (leg.route) {
          let baseRate = undefined;
          if (newRateType === 'MILE' || newRateType === 'MILE_FSC') {
            // For mile-based rates, try to get base rate from carrier or use current rate divided by miles
            if (selectedCarrier && selectedCarrier.ratePerMile) {
              baseRate = parseFloat(selectedCarrier.ratePerMile.toString());
            } else if (leg.route.distance && parseFloat(leg.rate) > 0) {
              baseRate = parseFloat(leg.rate) / parseFloat(leg.route.distance.toString());
            }
          } else {
            // For flat rate, use current rate as base
            baseRate = parseFloat(leg.rate) || 0;
          }
          
          const newRate = calculateLegRate(leg.route, newRateType, baseRate);
          updatedLeg.rate = newRate.toString();
          updatedLeg.baseRate = baseRate?.toString();
        }
        
        return updatedLeg;
      }
      return leg;
    }));
  };

  const updateLegBaseRate = (legId: string, newBaseRate: string) => {
    setBookingLegs(bookingLegs.map(leg => {
      if (leg.id === legId) {
        const baseRateNum = parseFloat(newBaseRate) || 0;
        const updatedLeg = { ...leg, baseRate: newBaseRate };
        
        // Recalculate final rate based on rate type
        if (leg.route) {
          const newRate = calculateLegRate(leg.route, leg.rateType, baseRateNum);
          updatedLeg.rate = newRate.toString();
        }
        
        return updatedLeg;
      }
      return leg;
    }));
  };

  const calculateLegRate = (route: Route, rateType: RateType = 'MILE', baseRate?: number): number => {
    const miles = route.distance ? parseFloat(route.distance.toString()) : 0;
    
    switch (rateType) {
      case 'MILE':
        if (baseRate !== undefined) {
          return baseRate * miles;
        } else if (selectedCarrier && selectedCarrier.ratePerMile) {
          return parseFloat(selectedCarrier.ratePerMile.toString()) * miles;
        } else if (route.standardRate) {
          return parseFloat(route.standardRate.toString()) * miles;
        }
        return 0;
        
      case 'MILE_FSC':
        let mileRate = 0;
        if (baseRate !== undefined) {
          mileRate = baseRate;
        } else if (selectedCarrier && selectedCarrier.ratePerMile) {
          mileRate = parseFloat(selectedCarrier.ratePerMile.toString());
        } else if (route.standardRate) {
          mileRate = parseFloat(route.standardRate.toString());
        }
        
        if (mileRate > 0) {
          const fscAmount = (mileRate * fuelSurchargeRate) / 100;
          const totalRatePerMile = mileRate + fscAmount;
          return totalRatePerMile * miles;
        }
        return 0;
        
      case 'FLAT_RATE':
        return baseRate || 0;
        
      default:
        return 0;
    }
  };

  const addRoute = (routeId: string) => {
    addBookingLeg(routeId);
  };

  const removeRoute = (routeId: string) => {
    if (isRoundTrip) {
      const leg = bookingLegs.find(leg => leg.routeId === routeId);
      if (leg) removeBookingLeg(leg.id);
    } else {
      setSelectedRoutes(selectedRoutes.filter(id => id !== routeId));
    }
  };

  const getTotalMiles = () => {
    if (isRoundTrip) {
      return bookingLegs.reduce((total, leg) => {
        const miles = leg.route?.distance ? parseFloat(leg.route.distance.toString()) : 0;
        return total + miles;
      }, 0);
    } else {
      return selectedRouteObjects.reduce((total, route) => {
        const miles = route.distance ? parseFloat(route.distance.toString()) : 0;
        return total + miles;
      }, 0);
    }
  };

  const getTotalRate = () => {
    if (isRoundTrip) {
      return bookingLegs.reduce((total, leg) => {
        const legRate = parseFloat(leg.rate || '0');
        return total + legRate;
      }, 0);
    } else {
      return parseFloat(rate || '0');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Booking</h1>
        <p className="text-gray-600">Create a new carrier booking for a route</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow-lg rounded-lg p-6">
        {/* Carrier Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Truck className="inline w-4 h-4 mr-1" />
            Select Carrier (Optional - Leave empty for unbooked)
          </label>
          <div className="space-y-2">
            <div className="relative">
              {/* Display selected carrier or search input */}
              {selectedCarrierName && !showCarrierDropdown ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 border-blue-200 flex items-center justify-between">
                  <div>
                    <span className="text-blue-900 font-medium">{selectedCarrierName}</span>
                    {selectedCarrier?.mcNumber && (
                      <span className="text-blue-700 text-sm ml-2">(MC: {selectedCarrier.mcNumber})</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearCarrierSelection}
                    className="text-blue-600 hover:text-blue-800 ml-2"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search carriers by name, MC#, or DOT#..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={carrierSearch}
                    onChange={(e) => handleCarrierSearch(e.target.value)}
                    onFocus={() => carrierSearch.length > 0 && setShowCarrierDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCarrierDropdown(false), 200)}
                  />
                  {/* Dropdown with filtered carriers */}
                  {showCarrierDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredCarriers.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCarrierId('');
                              setSelectedCarrierName('');
                              setCarrierEmail('');
                              setCarrierSearch('');
                              setShowCarrierDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 text-gray-600 italic"
                          >
                            No carrier (Unbooked)
                          </button>
                          {filteredCarriers.map((carrier: Carrier) => (
                            <button
                              key={carrier.id}
                              type="button"
                              onClick={() => handleCarrierSelect(carrier)}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{carrier.name}</div>
                              <div className="text-xs text-gray-500">
                                MC: {carrier.mcNumber || 'N/A'} | DOT: {carrier.dotNumber || 'N/A'}
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          {carrierSearch.length > 0 ? `No carriers found matching "${carrierSearch}"` : 'Start typing to search carriers'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {selectedCarrier && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>Location:</strong> {selectedCarrier.city}, {selectedCarrier.state}
              </p>
              {selectedCarrier.safetyRating && (
                <p className="text-sm text-gray-600">
                  <strong>Safety Rating:</strong> {selectedCarrier.safetyRating}
                </p>
              )}
              {selectedCarrier.ratePerMile && (
                <p className="text-sm text-gray-600">
                  <strong>Rate per Mile:</strong> ${selectedCarrier.ratePerMile}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Trip Type Selection */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tripType"
              checked={!isRoundTrip}
              onChange={() => setIsRoundTrip(false)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Single Route</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tripType"
              checked={isRoundTrip}
              onChange={() => setIsRoundTrip(true)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Multi-Leg Booking (Consolidated)</span>
          </label>
        </div>

        {/* Route Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="inline w-4 h-4 mr-1" />
            {isRoundTrip ? 'Select Routes *' : 'Select Route *'}
          </label>
          <div className="space-y-3">
            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                {/* Display selected origin or search input */}
                {originFilter && !showOriginDropdown ? (
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-blue-50 border-blue-200 flex items-center justify-between">
                    <span className="text-blue-900 font-medium">{originFilter}</span>
                    <button
                      type="button"
                      onClick={clearOriginSelection}
                      className="text-blue-600 hover:text-blue-800 ml-2"
                      title="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="All Origins"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={originSearchInput}
                      onChange={(e) => handleOriginSearch(e.target.value)}
                      onFocus={() => originSearchInput.length > 0 && setShowOriginDropdown(true)}
                      onBlur={() => setTimeout(() => setShowOriginDropdown(false), 200)}
                    />
                    {/* Dropdown with filtered origins */}
                    {showOriginDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredOrigins.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setOriginFilter('');
                                setOriginSearchInput('');
                                setShowOriginDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 text-gray-600 italic"
                            >
                              All Origins
                            </button>
                            {filteredOrigins.map((origin) => (
                              <button
                                key={origin}
                                type="button"
                                onClick={() => handleOriginSelect(origin)}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{origin}</div>
                              </button>
                            ))}
                          </>
                        ) : (
                          <div className="px-3 py-2 text-gray-500 text-sm">
                            {originSearchInput.length > 0 ? `No origins found matching "${originSearchInput}"` : 'Start typing to search origins'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative">
                {/* Display selected destination or search input */}
                {destinationFilter && !showDestinationDropdown ? (
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-blue-50 border-blue-200 flex items-center justify-between">
                    <span className="text-blue-900 font-medium">{destinationFilter}</span>
                    <button
                      type="button"
                      onClick={clearDestinationSelection}
                      className="text-blue-600 hover:text-blue-800 ml-2"
                      title="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="All Destinations"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={destinationSearchInput}
                      onChange={(e) => handleDestinationSearch(e.target.value)}
                      onFocus={() => destinationSearchInput.length > 0 && setShowDestinationDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDestinationDropdown(false), 200)}
                    />
                    {/* Dropdown with filtered destinations */}
                    {showDestinationDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredDestinations.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setDestinationFilter('');
                                setDestinationSearchInput('');
                                setShowDestinationDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 text-gray-600 italic"
                            >
                              All Destinations
                            </button>
                            {filteredDestinations.map((destination) => (
                              <button
                                key={destination}
                                type="button"
                                onClick={() => handleDestinationSelect(destination)}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{destination}</div>
                              </button>
                            ))}
                          </>
                        ) : (
                          <div className="px-3 py-2 text-gray-500 text-sm">
                            {destinationSearchInput.length > 0 ? `No destinations found matching "${destinationSearchInput}"` : 'Start typing to search destinations'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOriginFilter('');
                  setDestinationFilter('');
                  setOriginSearchInput('');
                  setDestinationSearchInput('');
                  setShowOriginDropdown(false);
                  setShowDestinationDropdown(false);
                }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Clear Filters
              </button>
            </div>

            {/* Active Filters Display */}
            {(originFilter || destinationFilter) && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-md">
                <span className="font-medium">Active filters:</span>
                {originFilter && <span className="bg-blue-100 px-2 py-1 rounded">Origin: {originFilter}</span>}
                {destinationFilter && <span className="bg-blue-100 px-2 py-1 rounded">Destination: {destinationFilter}</span>}
                <span className="ml-2 text-blue-700">({routes.length} routes found)</span>
              </div>
            )}
            
            {isRoundTrip ? (
              // Multiple route selection interface
              <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                <div className="mb-3 relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Add a route leg - search by name, origin, or destination..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={routeSearchInput}
                      onChange={(e) => handleRouteSearch(e.target.value)}
                      onFocus={() => routeSearchInput.length > 0 && setShowRouteDropdown(true)}
                      onBlur={() => setTimeout(() => setShowRouteDropdown(false), 200)}
                    />
                    {/* Dropdown with filtered routes */}
                    {showRouteDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredMultiRoutes.length > 0 ? (
                          filteredMultiRoutes.map((route: Route) => (
                            <button
                              key={route.id}
                              type="button"
                              onClick={() => handleMultiRouteSelect(route)}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{route.name}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <LocationWithTooltip 
                                  location={route.origin}
                                  address={route.originAddress}
                                  city={route.originCity}
                                  state={route.originState}
                                  zipCode={route.originZipCode}
                                  contact={route.originContact}
                                /> → <LocationWithTooltip 
                                  location={route.destination}
                                  address={route.destinationAddress}
                                  city={route.destinationCity}
                                  state={route.destinationState}
                                  zipCode={route.destinationZipCode}
                                  contact={route.destinationContact}
                                /> • {route.distance} miles
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-gray-500 text-sm">
                            {routeSearchInput.length > 0 ? `No available routes found matching "${routeSearchInput}"` : 'Start typing to search routes'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Booking Legs Display */}
                {bookingLegs.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Booking Legs:</h4>
                    {bookingLegs.map((leg, index) => (
                      <div key={leg.id} className="bg-white p-4 rounded border">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Leg {index + 1}: {leg.route?.name}
                            </p>
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <LocationWithTooltip 
                                location={leg.route?.origin || ''}
                                address={leg.route?.originAddress}
                                city={leg.route?.originCity}
                                state={leg.route?.originState}
                                zipCode={leg.route?.originZipCode}
                                contact={leg.route?.originContact}
                              /> → <LocationWithTooltip 
                                location={leg.route?.destination || ''}
                                address={leg.route?.destinationAddress}
                                city={leg.route?.destinationCity}
                                state={leg.route?.destinationState}
                                zipCode={leg.route?.destinationZipCode}
                                contact={leg.route?.destinationContact}
                              /> • {leg.route?.distance} miles
                            </p>
                            {leg.route?.departureTime && leg.route?.arrivalTime && (
                              <p className="text-xs text-gray-500">
                                {leg.route.departureTime} - {leg.route.arrivalTime}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBookingLeg(leg.id)}
                            className="text-red-500 hover:text-red-700 text-sm px-2"
                          >
                            Remove
                          </button>
                        </div>
                        
                        {/* Rate Type Selection */}
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs font-medium text-gray-700 mb-1 block">
                              Rate Type:
                            </label>
                            <div className="flex gap-2">
                              <label className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="radio"
                                  name={`legRateType_${leg.id}`}
                                  value="FLAT_RATE"
                                  checked={leg.rateType === 'FLAT_RATE'}
                                  onChange={(e) => updateLegRateType(leg.id, e.target.value as RateType)}
                                  className="text-blue-600"
                                />
                                <span>Flat Rate</span>
                              </label>
                              <label className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="radio"
                                  name={`legRateType_${leg.id}`}
                                  value="MILE"
                                  checked={leg.rateType === 'MILE'}
                                  onChange={(e) => updateLegRateType(leg.id, e.target.value as RateType)}
                                  className="text-blue-600"
                                />
                                <span>Per Mile</span>
                              </label>
                              <label className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="radio"
                                  name={`legRateType_${leg.id}`}
                                  value="MILE_FSC"
                                  checked={leg.rateType === 'MILE_FSC'}
                                  onChange={(e) => updateLegRateType(leg.id, e.target.value as RateType)}
                                  className="text-blue-600"
                                />
                                <span>Mile + FSC ({Number(fuelSurchargeRate || 0).toFixed(1)}%)</span>
                              </label>
                            </div>
                          </div>

                          {/* Base Rate Input for Mile and Mile+FSC */}
                          {(leg.rateType === 'MILE' || leg.rateType === 'MILE_FSC') && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-700 min-w-[80px]">
                                Rate per Mile:
                              </label>
                              <div className="relative flex-1">
                                <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                                <input
                                  type="number"
                                  step="0.01"
                                  value={leg.baseRate || ''}
                                  onChange={(e) => updateLegBaseRate(leg.id, e.target.value)}
                                  className="w-full pl-6 pr-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="0.00"
                                />
                              </div>
                              {leg.rateType === 'MILE_FSC' && (
                                <span className="text-xs text-gray-500">
                                  +{Number(fuelSurchargeRate || 0).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          )}

                          {/* Final Rate Display/Input */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-700 min-w-[80px]">
                              {leg.rateType === 'FLAT_RATE' ? 'Total Rate:' : 'Calculated Total:'}
                            </label>
                            <div className="relative flex-1">
                              <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                              {leg.rateType === 'FLAT_RATE' ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={leg.rate}
                                  onChange={(e) => updateLegRate(leg.id, e.target.value)}
                                  className="w-full pl-6 pr-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="0.00"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={`${parseFloat(leg.rate || '0').toFixed(2)}`}
                                  readOnly
                                  className="w-full pl-6 pr-3 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-600"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                        {/* Summary */}
                    <div className="mt-3 p-3 bg-blue-50 rounded-md">
                      <div className="grid grid-cols-3 gap-4 text-sm text-blue-800">
                        <div>
                          <strong>Total Legs:</strong> {bookingLegs.length}
                        </div>
                        <div>
                          <strong>Total Miles:</strong> {getTotalMiles().toFixed(1)}
                        </div>
                        <div>
                          <strong>Total Rate:</strong> ${getTotalRate().toFixed(2)}
                        </div>
                      </div>
                      <p className="text-xs text-blue-700 mt-2">
                        <strong>Note:</strong> This will create a single consolidated booking with all legs included in the notes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Single route selection with search
              <div className="relative">
                {/* Display selected route or search input */}
                {selectedRouteName && !showRouteDropdown ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 border-blue-200 flex items-center justify-between">
                    <div>
                      <span className="text-blue-900 font-medium">{selectedRouteName}</span>
                      {selectedRouteObjects[0]?.distance && (
                        <span className="text-blue-700 text-sm ml-2">({selectedRouteObjects[0].distance} mi)</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearSingleRouteSelection}
                      className="text-blue-600 hover:text-blue-800 ml-2"
                      title="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search routes by name, origin, or destination..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={routeSearchInput}
                      onChange={(e) => handleRouteSearch(e.target.value)}
                      onFocus={() => routeSearchInput.length > 0 && setShowRouteDropdown(true)}
                      onBlur={() => setTimeout(() => setShowRouteDropdown(false), 200)}
                    />
                    {/* Dropdown with filtered routes */}
                    {showRouteDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredRoutes.length > 0 ? (
                          filteredRoutes.map((route: Route) => (
                            <button
                              key={route.id}
                              type="button"
                              onClick={() => handleSingleRouteSelect(route)}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{route.name}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <LocationWithTooltip 
                                  location={route.origin}
                                  address={route.originAddress}
                                  city={route.originCity}
                                  state={route.originState}
                                  zipCode={route.originZipCode}
                                  contact={route.originContact}
                                /> → <LocationWithTooltip 
                                  location={route.destination}
                                  address={route.destinationAddress}
                                  city={route.destinationCity}
                                  state={route.destinationState}
                                  zipCode={route.destinationZipCode}
                                  contact={route.destinationContact}
                                /> • {route.distance} miles
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-gray-500 text-sm">
                            {routeSearchInput.length > 0 ? `No routes found matching "${routeSearchInput}"` : 'Start typing to search routes'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Single Route Details */}
          {!isRoundTrip && selectedRouteObjects.length === 1 && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>Distance:</strong> {selectedRouteObjects[0].distance} miles
              </p>
              {selectedRouteObjects[0].departureTime && selectedRouteObjects[0].arrivalTime && (
                <p className="text-sm text-gray-600">
                  <strong>Schedule:</strong> {selectedRouteObjects[0].departureTime} - {selectedRouteObjects[0].arrivalTime}
                </p>
              )}
              {selectedRouteObjects[0].standardRate && (
                <p className="text-sm text-gray-600">
                  <strong>Standard Rate:</strong> ${selectedRouteObjects[0].standardRate}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Booking Date */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              <Calendar className="inline w-4 h-4 mr-1" />
              Booking Date *
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useMultipleDates}
                onChange={(e) => setUseMultipleDates(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">Book multiple dates</span>
            </label>
          </div>
          
          {useMultipleDates ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={bookingDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={useMultipleDates}
                />
              </div>
            </div>
          ) : (
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          )}
          
          {useMultipleDates && bookingDate && endDate && (
            <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
              This will create {(() => {
                const start = new Date(bookingDate);
                const end = new Date(endDate);
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return days;
              })()} separate bookings, one for each day in the range.
            </p>
          )}
        </div>

        {/* Total Rate Display - Only show for multi-leg bookings */}
        {isRoundTrip && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="inline w-4 h-4 mr-1" />
              Total Rate
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={`${getTotalRate().toFixed(2)}`}
                readOnly
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Calculated from {bookingLegs.length} legs
            </p>
          </div>
        )}

        {/* Single Route Rate Configuration - Only show for single route */}
        {!isRoundTrip && selectedRouteObjects.length > 0 && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-md border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Rate Configuration</h3>
            
            {/* Rate Type Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rate Type *
              </label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="singleRateType"
                    value="FLAT_RATE"
                    checked={singleRouteRateType === 'FLAT_RATE'}
                    onChange={(e) => setSingleRouteRateType(e.target.value as RateType)}
                    className="text-blue-600"
                  />
                  <span>Flat Rate</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="singleRateType"
                    value="MILE"
                    checked={singleRouteRateType === 'MILE'}
                    onChange={(e) => setSingleRouteRateType(e.target.value as RateType)}
                    className="text-blue-600"
                  />
                  <span>Per Mile</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="singleRateType"
                    value="MILE_FSC"
                    checked={singleRouteRateType === 'MILE_FSC'}
                    onChange={(e) => setSingleRouteRateType(e.target.value as RateType)}
                    className="text-blue-600"
                  />
                  <span>Mile + FSC ({fuelSurchargeRate}%)</span>
                </label>
              </div>
            </div>

            {/* Base Rate Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {singleRouteRateType === 'FLAT_RATE' ? 'Total Rate' : 'Rate per Mile'} *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="number"
                  step="0.01"
                  value={singleRouteBaseRate}
                  onChange={(e) => setSingleRouteBaseRate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>
              {selectedCarrier?.ratePerMile && singleRouteRateType !== 'FLAT_RATE' && (
                <button
                  type="button"
                  onClick={() => setSingleRouteBaseRate(selectedCarrier.ratePerMile?.toString() || '')}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  Use carrier rate: ${selectedCarrier.ratePerMile}/mile
                </button>
              )}
            </div>

            {/* Calculated Total Rate Display */}
            <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-sm font-medium text-blue-900">
                    <DollarSign className="inline w-4 h-4 mr-1" />
                    Total Rate
                  </label>
                  {singleRouteRateType !== 'FLAT_RATE' && (
                    <p className="text-xs text-blue-700 mt-0.5">
                      {selectedRouteObjects[0].distance} miles × ${parseFloat(singleRouteBaseRate || '0').toFixed(2)}/mile
                      {singleRouteRateType === 'MILE_FSC' && ` + ${fuelSurchargeRate}% FSC`}
                    </p>
                  )}
                </div>
                <span className="text-xl font-bold text-blue-900">${rate}</span>
              </div>
            </div>
          </div>
        )}

        {/* Booking Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="bookingType"
                value="POWER_ONLY"
                checked={bookingType === 'POWER_ONLY'}
                onChange={(e) => setBookingType(e.target.value as 'POWER_ONLY' | 'POWER_AND_TRAILER')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Power Only</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="bookingType"
                value="POWER_AND_TRAILER"
                checked={bookingType === 'POWER_AND_TRAILER'}
                onChange={(e) => setBookingType(e.target.value as 'POWER_ONLY' | 'POWER_AND_TRAILER')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Power and Trailer</span>
            </label>
          </div>
          
          {/* Trailer Length - only show when Power and Trailer is selected */}
          {bookingType === 'POWER_AND_TRAILER' && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trailer Length (feet)
              </label>
              <input
                type="number"
                value={trailerLength}
                onChange={(e) => setTrailerLength(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter trailer length..."
                min="1"
                step="1"
              />
            </div>
          )}
        </div>
        
        {/* Billable */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="billable"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="billable" className="text-sm font-medium text-gray-700">
            Billable
          </label>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Add any additional notes..."
          />
        </div>

        {/* Driver Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Driver Name
            </label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Driver name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Phone number"
            />
          </div>
        </div>

        {/* Carrier Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Carrier Email
          </label>
          <input
            type="email"
            value={carrierEmail}
            onChange={(e) => setCarrierEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Carrier email for rate confirmation"
          />
          {carrierId && !carrierEmail && (
            <p className="mt-1 text-sm text-amber-600">
              No email address found for selected carrier. Please enter one manually for rate confirmation.
            </p>
          )}
        </div>

        {/* Carrier Report Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Carrier Report Time
          </label>
          <input
            type="time"
            value={carrierReportTime}
            onChange={(e) => setCarrierReportTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Time when carrier should report"
          />
          <p className="mt-1 text-sm text-gray-500">
            Auto-calculated as 45 minutes before route departure time. You can edit this if needed.
          </p>
        </div>

        {/* Error Message */}
        {createBookingMutation.isError && (
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">
                  Failed to create booking. Please try again.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={createBookingMutation.isPending}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {createBookingMutation.isPending ? 'Creating...' : 'Create Booking'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};