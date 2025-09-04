import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Carrier, Route } from '../types';
import { Calendar, Truck, MapPin, DollarSign, AlertCircle, Search } from 'lucide-react';
import { format } from 'date-fns';

export const NewBooking: React.FC = () => {
  const navigate = useNavigate();
  const [carrierId, setCarrierId] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [billable, setBillable] = useState(true);
  const [carrierSearch, setCarrierSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);

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
    
    if (!carrierId || selectedRoutes.length === 0 || !bookingDate || !rate) {
      alert('Please fill in all required fields');
      return;
    }

    // For multiple routes, create separate bookings for each route
    selectedRoutes.forEach(routeId => {
      createBookingMutation.mutate({
        carrierId: parseInt(carrierId),
        routeId: parseInt(routeId),
        bookingDate: new Date(bookingDate).toISOString(),
        rate: parseFloat(rate) / selectedRoutes.length, // Divide rate among routes
        billable,
        notes: notes || undefined,
        status: 'PENDING'
      });
    });
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

  const addRoute = (routeId: string) => {
    if (!selectedRoutes.includes(routeId)) {
      setSelectedRoutes([...selectedRoutes, routeId]);
      calculateSuggestedRate();
    }
  };

  const removeRoute = (routeId: string) => {
    setSelectedRoutes(selectedRoutes.filter(id => id !== routeId));
  };

  const getTotalMiles = () => {
    return selectedRouteObjects.reduce((total, route) => total + (route.miles || 0), 0);
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
                    <option value="">Add a route...</option>
                    {routes
                      .filter(route => !selectedRoutes.includes(route.id.toString()))
                      .map((route: Route) => (
                        <option key={route.id} value={route.id}>
                          {route.name} ({route.origin} → {route.destination}) - {route.miles} miles
                        </option>
                      ))}
                  </select>
                </div>
                
                {/* Selected Routes Display */}
                {selectedRoutes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Selected Routes:</h4>
                    {selectedRouteObjects.map((route, index) => (
                      <div key={route.id} className="flex items-center justify-between bg-white p-3 rounded border">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {index + 1}. {route.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {route.origin} → {route.destination} • {route.miles} miles
                          </p>
                          {route.departureTime && route.arrivalTime && (
                            <p className="text-xs text-gray-500">
                              {route.departureTime} - {route.arrivalTime}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRoute(route.id.toString())}
                          className="text-red-500 hover:text-red-700 text-sm px-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="mt-3 p-3 bg-blue-50 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>Total Distance:</strong> {getTotalMiles()} miles
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>Routes Selected:</strong> {selectedRoutes.length}
                      </p>
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

        {/* Rate */}
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