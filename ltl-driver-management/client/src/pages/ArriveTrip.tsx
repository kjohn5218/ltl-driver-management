import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/common/PageHeader';
import { linehaulTripService } from '../services/linehaulTripService';
import { LinehaulTrip } from '../types';

type SearchFilter = 'driverName' | 'manifestNumber' | 'powerUnit';

export const ArriveTrip: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('driverName');
  const [searchValue, setSearchValue] = useState('');
  const [selectedTrips, setSelectedTrips] = useState<number[]>([]);

  // Fetch trips that are in transit (ready to arrive)
  const { data: tripsData, isLoading } = useQuery({
    queryKey: ['trips-in-transit', searchValue, searchFilter],
    queryFn: () => linehaulTripService.getTrips({
      status: 'IN_TRANSIT',
      search: searchValue,
      limit: 50
    })
  });

  // Mutation to arrive trips
  const arriveTrips = useMutation({
    mutationFn: async (tripIds: number[]) => {
      const promises = tripIds.map(id =>
        linehaulTripService.updateTripStatus(id, {
          status: 'ARRIVED',
          actualArrivalTime: new Date().toISOString()
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Trips marked as arrived');
      setSelectedTrips([]);
      queryClient.invalidateQueries({ queryKey: ['trips-in-transit'] });
    },
    onError: () => {
      toast.error('Failed to arrive trips');
    }
  });

  const trips = tripsData?.trips || [];

  const toggleTripSelection = (tripId: number) => {
    setSelectedTrips(prev =>
      prev.includes(tripId)
        ? prev.filter(id => id !== tripId)
        : [...prev, tripId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTrips.length === trips.length) {
      setSelectedTrips([]);
    } else {
      setSelectedTrips(trips.map(trip => trip.id));
    }
  };

  const handleSubmit = () => {
    if (selectedTrips.length === 0) {
      toast.error('Please select at least one trip to arrive');
      return;
    }
    arriveTrips.mutate(selectedTrips);
  };

  const getTripType = (trip: LinehaulTrip): string => {
    return trip.linehaulProfile?.requiresTeamDriver ? 'Team' : 'Linehaul';
  };

  const getDriverName = (trip: LinehaulTrip): string => {
    return trip.driver?.name || trip.driverExternalId || 'Unassigned';
  };

  const getManifests = (trip: LinehaulTrip): string => {
    // This would come from trip shipments or manifests
    return trip.tripNumber || '-';
  };

  const getTrailers = (trip: LinehaulTrip): string[] => {
    const trailers: string[] = [];
    if (trip.trailer) trailers.push(trip.trailer.unitNumber);
    if (trip.trailer2) trailers.push(trip.trailer2.unitNumber);
    return trailers;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arrive Trip"
        subtitle="Mark trips as arrived at destination"
      />

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        {/* Search Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="w-full sm:w-48">
            <select
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value as SearchFilter)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="driverName">Driver Name</option>
              <option value="manifestNumber">Manifest #</option>
              <option value="powerUnit">Power Unit</option>
            </select>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`Search by ${searchFilter.replace(/([A-Z])/g, ' $1').toLowerCase()}...`}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Trips Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedTrips.length === trips.length && trips.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Manifest(s)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Power Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trailer(s)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Converter Dolly(s)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trip Type
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Truck className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No trips in transit</p>
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr
                    key={trip.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedTrips.includes(trip.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTrips.includes(trip.id)}
                        onChange={() => toggleTripSelection(trip.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {getDriverName(trip)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {getManifests(trip)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {trip.truck?.unitNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {getTrailers(trip).join(', ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {trip.dolly?.unitNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {getTripType(trip)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={selectedTrips.length === 0 || arriveTrips.isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {arriveTrips.isPending ? 'Processing...' : `Arrive Selected (${selectedTrips.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
