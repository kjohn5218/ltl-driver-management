import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { linehaulTripService } from '../services/linehaulTripService';
import { loadsheetService } from '../services/loadsheetService';
import { lateDepartureReasonService } from '../services/lateDepartureReasonService';
import { locationService } from '../services/locationService';
import { LinehaulTrip, Loadsheet, TripStatus } from '../types';
import {
  Percent,
  TrendingUp,
  Clock,
  Calendar,
  Download,
  RefreshCw,
  Building2,
  BarChart3,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

interface TripWithLoadsheets {
  trip: LinehaulTrip;
  loadsheets: Loadsheet[];
}

interface OriginMetrics {
  originCode: string;
  originName: string;
  tripCount: number;
  totalWeight: number;
  totalTrailerLength: number;
  loadFactor: number | null;
  hhTripCount: number;
  hhTotalWeight: number;
  hhTotalTrailerLength: number;
  hhLoadFactor: number | null;
  avgMinutesLate: number | null;
  lateCount: number;
}

export const LoadFactorReport: React.FC = () => {
  // Date range defaults to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [sortField, setSortField] = useState<'originCode' | 'loadFactor' | 'hhLoadFactor' | 'avgMinutesLate'>('originCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ['locations-list'],
    queryFn: () => locationService.getLocationsList(),
    staleTime: 5 * 60 * 1000
  });

  // Fetch dispatched trips
  const { data: tripsData, isLoading: tripsLoading, refetch: refetchTrips } = useQuery({
    queryKey: ['load-factor-trips', startDate, endDate],
    queryFn: () => linehaulTripService.getTrips({
      status: 'DISPATCHED' as TripStatus,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: 500
    })
  });

  // Fetch loadsheets
  const { data: loadsheetsData, refetch: refetchLoadsheets } = useQuery({
    queryKey: ['load-factor-loadsheets'],
    queryFn: async () => {
      const response = await loadsheetService.getLoadsheets({ limit: 500 });
      return response.loadsheets;
    }
  });

  // Fetch late departure reasons
  const { data: lateReasonsData, refetch: refetchLateReasons } = useQuery({
    queryKey: ['load-factor-late-reasons', startDate, endDate],
    queryFn: () => lateDepartureReasonService.getLateDepartureReasons({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: 500
    })
  });

  const trips = tripsData?.trips || [];
  const loadsheets = loadsheetsData || [];
  const lateReasons = lateReasonsData?.reasons || [];

  // Build trip rows with loadsheets
  const tripRows: TripWithLoadsheets[] = trips.map(trip => {
    const tripLoadsheets = loadsheets.filter(ls => ls.linehaulTripId === trip.id);
    return { trip, loadsheets: tripLoadsheets };
  });

  // Create a map of tripId to late minutes
  const tripLateMinutesMap = new Map<number, number>();
  lateReasons.forEach(reason => {
    if (reason.minutesLate !== null && reason.minutesLate !== undefined) {
      tripLateMinutesMap.set(reason.tripId, reason.minutesLate);
    }
  });

  // Calculate total weight for a trip
  const getTotalWeight = (row: TripWithLoadsheets): number => {
    if (row.loadsheets && row.loadsheets.length > 0) {
      return row.loadsheets.reduce((sum, ls) => sum + (ls.weight || 0), 0);
    }
    if (row.trip.shipments && row.trip.shipments.length > 0) {
      return row.trip.shipments.reduce((sum, s) => sum + (s.weight || 0), 0);
    }
    return 0;
  };

  // Calculate total trailer length for a trip
  const getTotalTrailerLength = (row: TripWithLoadsheets): number => {
    let totalLength = 0;
    if (row.trip.trailer?.lengthFeet) totalLength += row.trip.trailer.lengthFeet;
    if (row.trip.trailer2?.lengthFeet) totalLength += row.trip.trailer2.lengthFeet;
    if ((row.trip as any).trailer3?.lengthFeet) totalLength += (row.trip as any).trailer3.lengthFeet;

    // Fallback to loadsheet suggested lengths
    if (totalLength === 0 && row.loadsheets.length > 0) {
      totalLength = row.loadsheets.reduce((sum, ls) => sum + (ls.suggestedTrailerLength || 0), 0);
    }
    return totalLength;
  };

  // Get origin terminal code for a trip
  const getOriginCode = (row: TripWithLoadsheets): string => {
    // Try to get from linehaulProfile
    const profile = row.trip.linehaulProfile;
    if (profile?.originTerminal?.code) return profile.originTerminal.code;

    // Try loadsheet origin
    if (row.loadsheets.length > 0 && row.loadsheets[0].originTerminalCode) {
      return row.loadsheets[0].originTerminalCode;
    }

    // Parse from linehaulName
    const linehaulName = row.trip.linehaulName || row.loadsheets?.[0]?.linehaulName;
    if (linehaulName) {
      if (linehaulName.includes('-')) {
        return linehaulName.split('-')[0];
      }
      if (linehaulName.length >= 3) {
        return linehaulName.substring(0, 3);
      }
    }

    return 'UNKNOWN';
  };

  // Calculate metrics by origin
  const originMetrics = useMemo((): OriginMetrics[] => {
    const metricsMap = new Map<string, {
      originName: string;
      tripCount: number;
      totalWeight: number;
      totalTrailerLength: number;
      hhTripCount: number;
      hhTotalWeight: number;
      hhTotalTrailerLength: number;
      totalLateMinutes: number;
      lateCount: number;
    }>();

    tripRows.forEach(row => {
      const originCode = getOriginCode(row);
      const weight = getTotalWeight(row);
      const length = getTotalTrailerLength(row);
      const isHeadhaul = row.trip.linehaulProfile?.headhaul || false;
      const lateMinutes = tripLateMinutesMap.get(row.trip.id);

      const location = locations.find(l => l.code === originCode);
      const originName = location?.name || location?.city || originCode;

      if (!metricsMap.has(originCode)) {
        metricsMap.set(originCode, {
          originName,
          tripCount: 0,
          totalWeight: 0,
          totalTrailerLength: 0,
          hhTripCount: 0,
          hhTotalWeight: 0,
          hhTotalTrailerLength: 0,
          totalLateMinutes: 0,
          lateCount: 0
        });
      }

      const metrics = metricsMap.get(originCode)!;
      metrics.tripCount++;
      metrics.totalWeight += weight;
      metrics.totalTrailerLength += length;

      if (isHeadhaul) {
        metrics.hhTripCount++;
        metrics.hhTotalWeight += weight;
        metrics.hhTotalTrailerLength += length;
      }

      if (lateMinutes !== undefined) {
        metrics.totalLateMinutes += lateMinutes;
        metrics.lateCount++;
      }
    });

    const result: OriginMetrics[] = [];
    metricsMap.forEach((metrics, originCode) => {
      const loadFactor = metrics.totalTrailerLength > 0
        ? (metrics.totalWeight / (metrics.totalTrailerLength * 590)) * 100
        : null;
      const hhLoadFactor = metrics.hhTotalTrailerLength > 0
        ? (metrics.hhTotalWeight / (metrics.hhTotalTrailerLength * 590)) * 100
        : null;
      const avgMinutesLate = metrics.lateCount > 0
        ? metrics.totalLateMinutes / metrics.lateCount
        : null;

      result.push({
        originCode,
        originName: metrics.originName,
        tripCount: metrics.tripCount,
        totalWeight: metrics.totalWeight,
        totalTrailerLength: metrics.totalTrailerLength,
        loadFactor: loadFactor !== null ? Math.round(loadFactor * 10) / 10 : null,
        hhTripCount: metrics.hhTripCount,
        hhTotalWeight: metrics.hhTotalWeight,
        hhTotalTrailerLength: metrics.hhTotalTrailerLength,
        hhLoadFactor: hhLoadFactor !== null ? Math.round(hhLoadFactor * 10) / 10 : null,
        avgMinutesLate: avgMinutesLate !== null ? Math.round(avgMinutesLate) : null,
        lateCount: metrics.lateCount
      });
    });

    // Sort
    result.sort((a, b) => {
      let aVal: number | string | null;
      let bVal: number | string | null;

      switch (sortField) {
        case 'loadFactor':
          aVal = a.loadFactor;
          bVal = b.loadFactor;
          break;
        case 'hhLoadFactor':
          aVal = a.hhLoadFactor;
          bVal = b.hhLoadFactor;
          break;
        case 'avgMinutesLate':
          aVal = a.avgMinutesLate;
          bVal = b.avgMinutesLate;
          break;
        default:
          aVal = a.originCode;
          bVal = b.originCode;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [tripRows, locations, tripLateMinutesMap, sortField, sortDirection]);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    let totalWeight = 0;
    let totalLength = 0;
    let hhTotalWeight = 0;
    let hhTotalLength = 0;
    let totalLateMinutes = 0;
    let lateCount = 0;

    originMetrics.forEach(m => {
      totalWeight += m.totalWeight;
      totalLength += m.totalTrailerLength;
      hhTotalWeight += m.hhTotalWeight;
      hhTotalLength += m.hhTotalTrailerLength;
      if (m.avgMinutesLate !== null) {
        totalLateMinutes += m.avgMinutesLate * m.lateCount;
        lateCount += m.lateCount;
      }
    });

    return {
      loadFactor: totalLength > 0 ? Math.round((totalWeight / (totalLength * 590)) * 1000) / 10 : null,
      hhLoadFactor: hhTotalLength > 0 ? Math.round((hhTotalWeight / (hhTotalLength * 590)) * 1000) / 10 : null,
      avgMinutesLate: lateCount > 0 ? Math.round(totalLateMinutes / lateCount) : null,
      tripCount: tripRows.length,
      hhTripCount: tripRows.filter(r => r.trip.linehaulProfile?.headhaul).length
    };
  }, [originMetrics, tripRows]);

  // Chart data
  const chartData = originMetrics.filter(m => m.loadFactor !== null).map(m => ({
    origin: m.originCode,
    lf: m.loadFactor,
    hhLf: m.hhLoadFactor,
    avgLate: m.avgMinutesLate
  }));

  // Quick date filters
  const setDateRange = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleRefresh = () => {
    refetchTrips();
    refetchLoadsheets();
    refetchLateReasons();
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Origin', 'Origin Name', 'Trips', 'Total Weight', 'Trailer Length', 'LF %', 'HH Trips', 'HH LF %', 'Avg Minutes Late', 'Late Count'];
    const rows = originMetrics.map(m => [
      m.originCode,
      m.originName,
      m.tripCount.toString(),
      m.totalWeight.toString(),
      m.totalTrailerLength.toString(),
      m.loadFactor?.toFixed(1) || '',
      m.hhTripCount.toString(),
      m.hhLoadFactor?.toFixed(1) || '',
      m.avgMinutesLate?.toString() || '',
      m.lateCount.toString()
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `load-factor-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getLFColor = (lf: number | null) => {
    if (lf === null) return 'text-gray-400';
    if (lf >= 85) return 'text-green-600 dark:text-green-400';
    if (lf >= 65) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getLFBarColor = (lf: number | null) => {
    if (lf === null) return '#9CA3AF';
    if (lf >= 85) return '#10B981';
    if (lf >= 65) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Load Factor Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Analyze load factor, headhaul efficiency, and on-time performance by origin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            disabled={originMetrics.length === 0}
            className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Trips</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overallMetrics.tripCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              overallMetrics.loadFactor !== null && overallMetrics.loadFactor >= 85 ? 'bg-green-100 dark:bg-green-900/30' :
              overallMetrics.loadFactor !== null && overallMetrics.loadFactor >= 65 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
              'bg-red-100 dark:bg-red-900/30'
            }`}>
              <Percent className={`h-6 w-6 ${getLFColor(overallMetrics.loadFactor)}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall LF %</p>
              <p className={`text-2xl font-bold ${getLFColor(overallMetrics.loadFactor)}`}>
                {overallMetrics.loadFactor !== null ? `${overallMetrics.loadFactor}%` : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Headhaul Trips</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overallMetrics.hhTripCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              overallMetrics.hhLoadFactor !== null && overallMetrics.hhLoadFactor >= 85 ? 'bg-green-100 dark:bg-green-900/30' :
              overallMetrics.hhLoadFactor !== null && overallMetrics.hhLoadFactor >= 65 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
              'bg-purple-100 dark:bg-purple-900/30'
            }`}>
              <TrendingUp className={`h-6 w-6 ${getLFColor(overallMetrics.hhLoadFactor) || 'text-purple-600 dark:text-purple-400'}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">HH LF %</p>
              <p className={`text-2xl font-bold ${getLFColor(overallMetrics.hhLoadFactor)}`}>
                {overallMetrics.hhLoadFactor !== null ? `${overallMetrics.hhLoadFactor}%` : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Minutes Late</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {overallMetrics.avgMinutesLate !== null ? `+${overallMetrics.avgMinutesLate}` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Quick Date Filters */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div className="flex gap-1">
              <button
                onClick={() => setDateRange(7)}
                className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                7 Days
              </button>
              <button
                onClick={() => setDateRange(30)}
                className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                30 Days
              </button>
              <button
                onClick={setThisMonth}
                className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                This Month
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Load Factor by Origin</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="origin" />
              <YAxis domain={[0, 120]} unit="%" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labelMap: Record<string, string> = { lf: 'LF %', hhLf: 'HH LF %', avgLate: 'Avg Late (min)' };
                  return [name === 'avgLate' ? `${value} min` : `${value}%`, labelMap[name] || name];
                }}
              />
              <Legend />
              <Bar dataKey="lf" name="LF %" fill="#3B82F6">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getLFBarColor(entry.lf)} />
                ))}
              </Bar>
              <Bar dataKey="hhLf" name="HH LF %" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-gray-400" />
              Metrics by Origin
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {originMetrics.length} origins
            </span>
          </div>
        </div>

        {tripsLoading ? (
          <div className="p-6 text-center text-gray-500">Loading trip data...</div>
        ) : originMetrics.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No trip data found for the selected date range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th
                    onClick={() => handleSort('originCode')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center">
                      Origin
                      {sortField === 'originCode' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trips
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Weight
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trailer Ft
                  </th>
                  <th
                    onClick={() => handleSort('loadFactor')}
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-end">
                      LF %
                      {sortField === 'loadFactor' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    HH Trips
                  </th>
                  <th
                    onClick={() => handleSort('hhLoadFactor')}
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-end">
                      HH LF %
                      {sortField === 'hhLoadFactor' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('avgMinutesLate')}
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-end">
                      Avg Min Late
                      {sortField === 'avgMinutesLate' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {originMetrics.map((metrics) => (
                  <tr key={metrics.originCode} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{metrics.originCode}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{metrics.originName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-900 dark:text-gray-100">
                      {metrics.tripCount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">
                      {metrics.totalWeight.toLocaleString()} lbs
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">
                      {metrics.totalTrailerLength}'
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className={`font-medium ${getLFColor(metrics.loadFactor)}`}>
                        {metrics.loadFactor !== null ? `${metrics.loadFactor}%` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">
                      {metrics.hhTripCount > 0 ? metrics.hhTripCount : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className={`font-medium ${getLFColor(metrics.hhLoadFactor)}`}>
                        {metrics.hhLoadFactor !== null ? `${metrics.hhLoadFactor}%` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {metrics.avgMinutesLate !== null ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">+{metrics.avgMinutesLate}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      {metrics.lateCount > 0 && (
                        <span className="text-xs text-gray-400 ml-1">({metrics.lateCount})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
