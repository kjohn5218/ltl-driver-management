import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle, Truck, X, User, FileText, ArrowRight, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { linehaulTripService } from '../../services/linehaulTripService';
import { LinehaulTrip } from '../../types';
import { ArrivalDetailsModal } from './ArrivalDetailsModal';

interface ArriveTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type SearchFilter = 'driverName' | 'manifestNumber' | 'powerUnit';

export const ArriveTripModal: React.FC<ArriveTripModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('driverName');
  const [searchValue, setSearchValue] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [showArrivalModal, setShowArrivalModal] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchFilter('driverName');
      setSearchValue('');
      setSelectedTrip(null);
      setShowArrivalModal(false);
    }
  }, [isOpen]);

  // Fetch trips that are in transit (ready to arrive)
  const { data: tripsData, isLoading, refetch } = useQuery({
    queryKey: ['trips-in-transit-modal', searchValue, searchFilter],
    queryFn: () => linehaulTripService.getTrips({
      status: 'IN_TRANSIT',
      search: searchValue,
      limit: 50
    }),
    enabled: isOpen
  });

  const trips = tripsData?.trips || [];

  // Get the selected trip object
  const selectedTripData = trips.find(trip => trip.id === selectedTrip);

  const handleTripSelect = (tripId: number) => {
    setSelectedTrip(prev => prev === tripId ? null : tripId);
  };

  const handleSubmit = () => {
    if (!selectedTrip) {
      toast.error('Please select a trip to arrive');
      return;
    }
    setShowArrivalModal(true);
  };

  const handleArrivalSuccess = () => {
    setSelectedTrip(null);
    queryClient.invalidateQueries({ queryKey: ['trips-in-transit-modal'] });
    queryClient.invalidateQueries({ queryKey: ['trips-in-transit'] });
    queryClient.invalidateQueries({ queryKey: ['inbound-trips'] });
    refetch();
    onSuccess?.();
  };

  const getDriverName = (trip: LinehaulTrip): string => {
    return trip.driver?.name || trip.driverExternalId || 'Unassigned';
  };

  const getManifests = (trip: LinehaulTrip): string => {
    if (trip.loadsheets && trip.loadsheets.length > 0) {
      return trip.loadsheets.map(ls => ls.manifestNumber).join(', ');
    }
    return '-';
  };

  const getTrailers = (trip: LinehaulTrip): string[] => {
    const trailers: string[] = [];
    if (trip.trailer) trailers.push(trip.trailer.unitNumber);
    if (trip.trailer2) trailers.push(trip.trailer2.unitNumber);
    if (trip.trailer3) trailers.push((trip.trailer3 as any).unitNumber);
    return trailers;
  };

  const getDollies = (trip: LinehaulTrip): string[] => {
    const dollies: string[] = [];
    if (trip.dolly) dollies.push(trip.dolly.unitNumber);
    if (trip.dolly2) dollies.push(trip.dolly2.unitNumber);
    return dollies;
  };

  const isOwnOp = (trip: LinehaulTrip): boolean => {
    return !trip.truckId;
  };

  const getRoute = (trip: LinehaulTrip): { origin: string; destination: string } => {
    const origin = trip.linehaulProfile?.originTerminal?.code || '-';
    const destination = trip.linehaulProfile?.destinationTerminal?.code || '-';
    return { origin, destination };
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" onClick={onClose} />

          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-orange-500 mr-2" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Arrive Trip
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Mark trips as arrived at destination
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Search Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
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
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        {/* Radio button column */}
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
                        Route
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Dolly(s)
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
                      trips.map((trip) => {
                        const route = getRoute(trip);
                        return (
                          <tr
                            key={trip.id}
                            onClick={() => handleTripSelect(trip.id)}
                            className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              selectedTrip === trip.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="radio"
                                name="selectedTrip"
                                checked={selectedTrip === trip.id}
                                onChange={() => handleTripSelect(trip.id)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center">
                                <User className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-gray-900 dark:text-gray-100">
                                  {getDriverName(trip)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-gray-900 dark:text-gray-100">
                                  {getManifests(trip)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center">
                                <Truck className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-gray-900 dark:text-gray-100">
                                  {isOwnOp(trip) ? (
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">OWNOP</span>
                                  ) : (
                                    trip.truck?.unitNumber || '-'
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {getTrailers(trip).join(', ') || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center text-gray-600 dark:text-gray-400">
                                <MapPin className="h-4 w-4 mr-1" />
                                <span className="font-medium">{route.origin}</span>
                                <ArrowRight className="h-3 w-3 mx-1" />
                                <span className="font-medium">{route.destination}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {getDollies(trip).join(', ') || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedTrip}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Arrive Selected
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Arrival Details Modal */}
      {selectedTripData && (
        <ArrivalDetailsModal
          isOpen={showArrivalModal}
          onClose={() => setShowArrivalModal(false)}
          trip={selectedTripData}
          onSuccess={handleArrivalSuccess}
        />
      )}
    </>
  );
};
