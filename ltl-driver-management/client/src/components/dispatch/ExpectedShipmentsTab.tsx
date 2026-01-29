import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { expectedShipmentService } from '../../services/expectedShipmentService';
import { locationService } from '../../services/locationService';
import { ExpectedLaneVolume, ExpectedShipmentDetail } from '../../types';
import { LocationMultiSelect } from '../LocationMultiSelect';
import { DateRangePicker } from '../common/DateRangePicker';
import {
  Package,
  Scale,
  Truck,
  AlertTriangle,
  TrendingUp,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  Info
} from 'lucide-react';
import { format, addDays } from 'date-fns';

interface LaneDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lane: ExpectedLaneVolume | null;
  details: ExpectedShipmentDetail[];
  isLoading: boolean;
}

const LaneDetailsModal: React.FC<LaneDetailsModalProps> = ({
  isOpen,
  onClose,
  lane,
  details,
  isLoading
}) => {
  if (!isOpen || !lane) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="relative inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-lg">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Expected Shipments: {lane.laneName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Forecast for {format(new Date(lane.forecastDate), 'MMM d, yyyy')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              ×
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-xs text-blue-600 dark:text-blue-400">Shipments</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{lane.expectedShipmentCount}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400">Pieces</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">{lane.expectedPieces.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
              <p className="text-xs text-purple-600 dark:text-purple-400">Weight (lbs)</p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{lane.expectedWeight.toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400">Est. Trailers</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{lane.estimatedTrailers?.toFixed(1) || '-'}</p>
            </div>
          </div>

          {/* Shipment Details Table */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : details.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No shipment details available</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">PRO #</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Service</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Pcs</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Weight</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Consignee</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Shipper</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Special</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {details.map((detail, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2 text-gray-900 dark:text-white font-mono text-xs">
                        {detail.externalProNumber || <span className="text-gray-400">Pending</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          detail.serviceLevel === 'GUARANTEED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                          detail.serviceLevel === 'EXPEDITED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {detail.serviceLevel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{detail.pieces}</td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{detail.weight.toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">
                        {detail.consigneeName && (
                          <div>{detail.consigneeName}</div>
                        )}
                        {detail.consigneeCity && (
                          <div className="text-gray-500 dark:text-gray-400">{detail.consigneeCity}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">
                        {detail.shipperName && (
                          <div>{detail.shipperName}</div>
                        )}
                        {detail.shipperCity && (
                          <div className="text-gray-500 dark:text-gray-400">{detail.shipperCity}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {detail.isHazmat && (
                            <span title="Hazmat" className="text-orange-500">
                              <AlertTriangle className="w-4 h-4" />
                            </span>
                          )}
                          {detail.isHighValue && (
                            <span title="High Value" className="text-yellow-500">$</span>
                          )}
                          {detail.appointmentRequired && (
                            <span title="Appointment Required" className="text-blue-500">
                              <Clock className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ExpectedShipmentsTab: React.FC = () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextWeek);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrigins, setSelectedOrigins] = useState<number[]>([]);
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set());
  const [aggregateView, setAggregateView] = useState(true);

  // Lane details modal state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedLane, setSelectedLane] = useState<ExpectedLaneVolume | null>(null);
  const [laneDetails, setLaneDetails] = useState<ExpectedShipmentDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch locations for displaying selected filter names
  const { data: locationsData } = useQuery({
    queryKey: ['locations-list'],
    queryFn: () => locationService.getLocationsList(),
    staleTime: 5 * 60 * 1000
  });
  const locations = locationsData || [];

  // Get selected origin codes for filtering
  const selectedOriginCodes = useMemo(() => {
    return selectedOrigins
      .map(id => locations.find(l => l.id === id)?.code)
      .filter(Boolean) as string[];
  }, [selectedOrigins, locations]);

  // Fetch expected shipments from TMS
  const { data: shipmentsData, isLoading, refetch } = useQuery({
    queryKey: ['expected-shipments-tms', startDate, endDate, selectedOriginCodes.join(','), aggregateView],
    queryFn: () => expectedShipmentService.getExpectedShipmentsFromTMS({
      startDate,
      endDate,
      originTerminalCode: selectedOriginCodes.length === 1 ? selectedOriginCodes[0] : undefined,
      aggregated: aggregateView
    }),
    refetchInterval: 60000 // Refresh every minute
  });

  const volumes = shipmentsData?.volumes || [];
  const summary = shipmentsData?.summary;

  // Filter volumes by search term and selected origins
  const filteredVolumes = useMemo(() => {
    let filtered = volumes;

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.laneName?.toLowerCase().includes(search) ||
        v.originTerminalCode.toLowerCase().includes(search) ||
        v.destinationTerminalCode.toLowerCase().includes(search)
      );
    }

    // Filter by selected origins (if multiple selected)
    if (selectedOriginCodes.length > 1) {
      filtered = filtered.filter(v => selectedOriginCodes.includes(v.originTerminalCode));
    }

    return filtered;
  }, [volumes, searchTerm, selectedOriginCodes]);

  // Group volumes by origin for display
  const volumesByOrigin = useMemo(() => {
    const grouped: Record<string, ExpectedLaneVolume[]> = {};
    filteredVolumes.forEach(v => {
      if (!grouped[v.originTerminalCode]) {
        grouped[v.originTerminalCode] = [];
      }
      grouped[v.originTerminalCode].push(v);
    });
    return grouped;
  }, [filteredVolumes]);

  const toggleLaneExpand = (laneName: string) => {
    const newExpanded = new Set(expandedLanes);
    if (newExpanded.has(laneName)) {
      newExpanded.delete(laneName);
    } else {
      newExpanded.add(laneName);
    }
    setExpandedLanes(newExpanded);
  };

  const handleViewDetails = async (lane: ExpectedLaneVolume) => {
    setSelectedLane(lane);
    setDetailsModalOpen(true);
    setLoadingDetails(true);

    try {
      const response = await expectedShipmentService.getLaneShipmentDetails(
        lane.originTerminalCode,
        lane.destinationTerminalCode,
        lane.forecastDate
      );
      setLaneDetails(response.details);
    } catch (error) {
      console.error('Failed to fetch lane details:', error);
      setLaneDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range */}
          <div className="flex-shrink-0">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </div>

          {/* Origin Filter */}
          <div className="flex-shrink-0 min-w-[200px]">
            <LocationMultiSelect
              label=""
              selectedIds={selectedOrigins}
              onChange={setSelectedOrigins}
              placeholder="Filter by origin..."
            />
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search lanes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAggregateView(!aggregateView)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                aggregateView
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {aggregateView ? 'Aggregated' : 'By Date'}
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Shipments</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.totalShipments.toLocaleString()}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Pieces</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.totalPieces.toLocaleString()}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Weight (lbs)</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.totalWeight.toLocaleString()}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Est. Trailers</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.totalTrailers.toFixed(1)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Hazmat</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.hazmatShipments.toLocaleString()}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Guaranteed</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.guaranteedShipments.toLocaleString()}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-teal-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Lanes</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {summary.laneCount}
            </p>
          </div>
        </div>
      )}

      {/* Lane Volumes Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : filteredVolumes.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No expected shipments found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Lane</th>
                  {!aggregateView && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Shipments</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pieces</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Weight</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Trailers</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Service Mix</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Special</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {Object.entries(volumesByOrigin).map(([origin, lanes]) => (
                  <React.Fragment key={origin}>
                    {/* Origin Group Header */}
                    <tr className="bg-gray-100 dark:bg-gray-700/50">
                      <td colSpan={aggregateView ? 8 : 9} className="px-4 py-2">
                        <button
                          onClick={() => toggleLaneExpand(origin)}
                          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          {expandedLanes.has(origin) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                          <span className="font-bold">{origin}</span>
                          <span className="text-gray-500">({lanes.length} lanes, {lanes.reduce((sum, l) => sum + l.expectedShipmentCount, 0)} shipments)</span>
                        </button>
                      </td>
                    </tr>

                    {/* Lane Rows */}
                    {(expandedLanes.has(origin) || expandedLanes.size === 0) && lanes.map((lane, index) => (
                      <tr key={`${lane.laneName}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {lane.originTerminalCode}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {lane.destinationTerminalCode}
                            </span>
                          </div>
                        </td>
                        {!aggregateView && (
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(lane.forecastDate), 'MMM d')}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          {lane.expectedShipmentCount}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {lane.expectedPieces.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {lane.expectedWeight.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-sm font-medium">
                            {lane.estimatedTrailers?.toFixed(1) || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 text-xs">
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 rounded text-gray-600 dark:text-gray-300" title="Standard">
                              S:{lane.standardCount}
                            </span>
                            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 rounded text-green-600 dark:text-green-300" title="Guaranteed">
                              G:{lane.guaranteedCount}
                            </span>
                            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-300" title="Expedited">
                              E:{lane.expeditedCount}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {lane.hazmatCount > 0 && (
                              <span className="flex items-center gap-1 text-orange-500 text-xs" title="Hazmat shipments">
                                <AlertTriangle className="w-4 h-4" />
                                {lane.hazmatCount}
                              </span>
                            )}
                            {lane.highValueCount > 0 && (
                              <span className="text-yellow-500 text-xs" title="High value shipments">
                                $:{lane.highValueCount}
                              </span>
                            )}
                            {lane.hazmatCount === 0 && lane.highValueCount === 0 && (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleViewDetails(lane)}
                            className="p-1 text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
                            title="View shipment details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lane Details Modal */}
      <LaneDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        lane={selectedLane}
        details={laneDetails}
        isLoading={loadingDetails}
      />
    </div>
  );
};
