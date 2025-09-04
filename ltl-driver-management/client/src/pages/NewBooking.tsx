import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Carrier, Route } from '../types';
import { Calendar, Truck, MapPin, DollarSign, AlertCircle, Search } from 'lucide-react';
import { format } from 'date-fns';

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
  const [carrierId, setCarrierId] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [bookingLegs, setBookingLegs] = useState<BookingLeg[]>([]);
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [billable, setBillable] = useState(true);
  const [carrierSearch, setCarrierSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [fuelSurchargeRate, setFuelSurchargeRate] = useState<number>(0);

  // Fetch carriers
  const { data: carriersData, isLoading: loadingCarriers } = useQuery({
    queryKey: ['carriers', carrierSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('status', 'ACTIVE');
      params.append('limit', '1000');
      if (carrierSearch.trim()) params.append('search', carrierSearch.trim());
      
      const response = await api.get(`/carriers?${params.toString()}`);
      return response.data;
    }
  });

  // Fetch routes
  const { data: routesData, isLoading: loadingRoutes } = useQuery({
    queryKey: ['routes', routeSearch, originFilter, destinationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '1500');
      if (routeSearch.trim()) params.append('search', routeSearch.trim());
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
  const selectedRouteObjects = routes.filter((r: Route) => selectedRoutes.includes(r.id.toString()));

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/bookings', data);
      return response.data;
    },
    onSuccess: () => {
      navigate('/bookings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!carrierId || !bookingDate) {
      alert('Please fill in all required fields');
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

      // Create multi-leg booking
      const bookingGroupId = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      bookingLegs.forEach((leg, index) => {
        createBookingMutation.mutate({
          carrierId: parseInt(carrierId),
          routeId: parseInt(leg.routeId),
          bookingDate: new Date(bookingDate).toISOString(),
          rate: parseFloat(leg.rate),
          rateType: leg.rateType,
          baseRate: leg.baseRate ? parseFloat(leg.baseRate) : undefined,
          fscRate: leg.rateType === 'MILE_FSC' ? fuelSurchargeRate : undefined,
          billable,
          notes: notes || undefined,
          status: 'PENDING',
          bookingGroupId,
          legNumber: index + 1,
          isParent: index === 0, // First leg is the parent
          parentBookingId: index === 0 ? undefined : null // Will be set after parent is created
        });
      });
    } else {
      // Single route booking validation
      if (selectedRoutes.length === 0 || !rate || parseFloat(rate) <= 0) {
        alert('Please select a route and enter a valid rate');
        return;
      }

      createBookingMutation.mutate({
        carrierId: parseInt(carrierId),
        routeId: parseInt(selectedRoutes[0]),
        bookingDate: new Date(bookingDate).toISOString(),
        rate: parseFloat(rate),
        rateType: 'FLAT_RATE', // Single route bookings use flat rate by default
        baseRate: parseFloat(rate),
        billable,
        notes: notes || undefined,
        status: 'PENDING',
        legNumber: 1,
        isParent: true
      });
    }
  };

  const calculateSuggestedRate = () => {
    if (selectedCarrier && selectedRouteObjects.length > 0) {
      let totalRate = 0;
      
      selectedRouteObjects.forEach(route => {
        // If carrier has a rate per mile and route has miles
        if (selectedCarrier.ratePerMile && route.miles) {
          totalRate += parseFloat(selectedCarrier.ratePerMile.toString()) * parseFloat(route.miles.toString());
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
            } else if (leg.route.miles && parseFloat(leg.rate) > 0) {
              baseRate = parseFloat(leg.rate) / parseFloat(leg.route.miles.toString());
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
    const miles = route.miles ? parseFloat(route.miles.toString()) : 0;
    
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
        const miles = leg.route?.miles ? parseFloat(leg.route.miles.toString()) : 0;
        return total + miles;
      }, 0);
    } else {
      return selectedRouteObjects.reduce((total, route) => {
        const miles = route.miles ? parseFloat(route.miles.toString()) : 0;
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
            Select Carrier *
          </label>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search carriers by name, MC#, or DOT#..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={carrierSearch}
                onChange={(e) => setCarrierSearch(e.target.value)}
              />
            </div>
            <select
              value={carrierId}
              onChange={(e) => {
                setCarrierId(e.target.value);
                calculateSuggestedRate();
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a carrier...</option>
              {carriers.map((carrier: Carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name} (MC: {carrier.mcNumber || 'N/A'}, DOT: {carrier.dotNumber || 'N/A'})
                </option>
              ))}
            </select>
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
            <span className="text-sm font-medium text-gray-700">Round Trip / Multiple Routes</span>
          </label>
        </div>

        {/* Route Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="inline w-4 h-4 mr-1" />
            {isRoundTrip ? 'Select Routes *' : 'Select Route *'}
          </label>
          <div className="space-y-3">
            {/* Search and Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search routes..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                />
              </div>
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Origins</option>
                {uniqueOrigins.map(origin => (
                  <option key={origin} value={origin}>{origin}</option>
                ))}
              </select>
              <select
                value={destinationFilter}
                onChange={(e) => setDestinationFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Destinations</option>
                {uniqueDestinations.map(destination => (
                  <option key={destination} value={destination}>{destination}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setRouteSearch('');
                  setOriginFilter('');
                  setDestinationFilter('');
                }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Clear Filters
              </button>
            </div>

            {/* Active Filters Display */}
            {(routeSearch || originFilter || destinationFilter) && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-md">
                <span className="font-medium">Active filters:</span>
                {routeSearch && <span className="bg-blue-100 px-2 py-1 rounded">Search: "{routeSearch}"</span>}
                {originFilter && <span className="bg-blue-100 px-2 py-1 rounded">Origin: {originFilter}</span>}
                {destinationFilter && <span className="bg-blue-100 px-2 py-1 rounded">Destination: {destinationFilter}</span>}
                <span className="ml-2 text-blue-700">({routes.length} routes found)</span>
              </div>
            )}
            
            {isRoundTrip ? (
              // Multiple route selection interface
              <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                <div className="mb-3">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addRoute(e.target.value);
                        e.target.value = ''; // Reset select
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Add a route leg...</option>
                    {routes
                      .filter(route => !bookingLegs.find(leg => leg.routeId === route.id.toString()))
                      .map((route: Route) => (
                        <option key={route.id} value={route.id}>
                          {route.name} ({route.origin} → {route.destination}) - {route.miles} miles
                        </option>
                      ))}
                  </select>
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
                            <p className="text-xs text-gray-600">
                              {leg.route?.origin} → {leg.route?.destination} • {leg.route?.miles} miles
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
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-700 min-w-[60px]">
                              Rate Type:
                            </label>
                            <select
                              value={leg.rateType}
                              onChange={(e) => updateLegRateType(leg.id, e.target.value as RateType)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="MILE">Mile</option>
                              <option value="MILE_FSC">Mile + FSC ({Number(fuelSurchargeRate || 0).toFixed(1)}%)</option>
                              <option value="FLAT_RATE">Flat Rate</option>
                            </select>
                          </div>

                          {/* Base Rate Input for Mile and Mile+FSC */}
                          {(leg.rateType === 'MILE' || leg.rateType === 'MILE_FSC') && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-700 min-w-[60px]">
                                Per Mile:
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
                            <label className="text-xs font-medium text-gray-700 min-w-[60px]">
                              {leg.rateType === 'FLAT_RATE' ? 'Total Rate:' : 'Calculated:'}
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
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Single route selection
              <select
                value={selectedRoutes[0] || ''}
                onChange={(e) => {
                  setSelectedRoutes(e.target.value ? [e.target.value] : []);
                  calculateSuggestedRate();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a route...</option>
                {routes.map((route: Route) => (
                  <option key={route.id} value={route.id}>
                    {route.name} ({route.origin} → {route.destination}) - {route.miles} miles
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Single Route Details */}
          {!isRoundTrip && selectedRouteObjects.length === 1 && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>Distance:</strong> {selectedRouteObjects[0].miles} miles
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            Booking Date *
          </label>
          <input
            type="date"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Total Rate Display */}
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
            {isRoundTrip 
              ? `Calculated from ${bookingLegs.length} legs`
              : 'Enter rate for the selected route above'
            }
          </p>
        </div>

        {/* Single Route Rate Input - Only show for single route */}
        {!isRoundTrip && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="inline w-4 h-4 mr-1" />
              Rate *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                required
              />
            </div>
            {selectedCarrier && selectedRouteObjects.length > 0 && (
              <button
                type="button"
                onClick={calculateSuggestedRate}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Calculate suggested rate
              </button>
            )}
          </div>
        )}

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