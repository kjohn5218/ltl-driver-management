import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ArrowRightLeft, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/common/PageHeader';
import { manifestService } from '../services/manifestService';

export const TransferScans: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentManifestIndex, setCurrentManifestIndex] = useState(0);
  const [selectedShipments, setSelectedShipments] = useState<number[]>([]);
  const [useExistingManifest, setUseExistingManifest] = useState(true);
  const [newManifestNumber, setNewManifestNumber] = useState('');
  const [targetManifestId, setTargetManifestId] = useState<number | null>(null);

  // Fetch all open manifests
  const { data: manifests, isLoading: loadingManifests } = useQuery({
    queryKey: ['open-manifests'],
    queryFn: () => manifestService.getOpenManifests()
  });

  const currentManifest = manifests?.[currentManifestIndex];

  // Fetch shipments for current manifest
  const { data: shipments, isLoading: loadingShipments } = useQuery({
    queryKey: ['manifest-shipments', currentManifest?.id],
    queryFn: () => manifestService.getManifestShipments(currentManifest!.id),
    enabled: !!currentManifest?.id
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: (request: { shipmentIds: number[]; targetManifestId?: number; newManifestNumber?: string }) =>
      manifestService.transferShipments(request),
    onSuccess: () => {
      toast.success('Shipments transferred successfully');
      setSelectedShipments([]);
      setNewManifestNumber('');
      setTargetManifestId(null);
      queryClient.invalidateQueries({ queryKey: ['open-manifests'] });
      queryClient.invalidateQueries({ queryKey: ['manifest-shipments'] });
    },
    onError: () => {
      toast.error('Failed to transfer shipments');
    }
  });

  const handlePrevManifest = () => {
    if (manifests && currentManifestIndex > 0) {
      setCurrentManifestIndex(prev => prev - 1);
      setSelectedShipments([]);
    }
  };

  const handleNextManifest = () => {
    if (manifests && currentManifestIndex < manifests.length - 1) {
      setCurrentManifestIndex(prev => prev + 1);
      setSelectedShipments([]);
    }
  };

  const toggleShipmentSelection = (shipmentId: number) => {
    setSelectedShipments(prev =>
      prev.includes(shipmentId)
        ? prev.filter(id => id !== shipmentId)
        : [...prev, shipmentId]
    );
  };

  const handleSelectAll = () => {
    if (shipments && selectedShipments.length === shipments.length) {
      setSelectedShipments([]);
    } else if (shipments) {
      setSelectedShipments(shipments.map(s => s.id));
    }
  };

  const handleTransfer = () => {
    if (selectedShipments.length === 0) {
      toast.error('Please select shipments to transfer');
      return;
    }

    if (!useExistingManifest && !newManifestNumber) {
      toast.error('Please enter a new manifest number');
      return;
    }

    if (useExistingManifest && !targetManifestId) {
      toast.error('Please select a target manifest');
      return;
    }

    transferMutation.mutate({
      shipmentIds: selectedShipments,
      targetManifestId: useExistingManifest ? targetManifestId! : undefined,
      newManifestNumber: !useExistingManifest ? newManifestNumber : undefined
    });
  };

  const otherManifests = manifests?.filter((_, index) => index !== currentManifestIndex) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfer Scans"
        subtitle="Transfer shipments between manifests"
      />

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        {/* Manifest Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevManifest}
            disabled={!manifests || currentManifestIndex === 0}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentManifest?.manifestNumber || 'No Manifests'}
            </h2>
            {manifests && manifests.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manifest {currentManifestIndex + 1} of {manifests.length}
              </p>
            )}
          </div>

          <button
            onClick={handleNextManifest}
            disabled={!manifests || currentManifestIndex >= manifests.length - 1}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Transfer Options */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useExistingManifest}
                onChange={() => setUseExistingManifest(true)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Existing Manifest</span>
            </label>

            {useExistingManifest && (
              <select
                value={targetManifestId || ''}
                onChange={(e) => setTargetManifestId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="">Select target manifest...</option>
                {otherManifests.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.manifestNumber}
                  </option>
                ))}
              </select>
            )}

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={!useExistingManifest}
                onChange={() => setUseExistingManifest(false)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">New Manifest</span>
            </label>

            {!useExistingManifest && (
              <input
                type="text"
                value={newManifestNumber}
                onChange={(e) => setNewManifestNumber(e.target.value)}
                placeholder="New manifest number..."
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            )}
          </div>
        </div>

        {/* Shipments Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={shipments && selectedShipments.length === shipments.length && shipments.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Consignee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pro #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Loaded
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loadingShipments || loadingManifests ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  </td>
                </tr>
              ) : !shipments || shipments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No shipments on this manifest</p>
                  </td>
                </tr>
              ) : (
                shipments.map((shipment) => (
                  <tr
                    key={shipment.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedShipments.includes(shipment.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedShipments.includes(shipment.id)}
                        onChange={() => toggleShipmentSelection(shipment.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {shipment.consignee}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {shipment.location || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <a
                        href="#"
                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        {shipment.proNumber}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {shipment.loadedCount} of {shipment.totalCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Transfer Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleTransfer}
            disabled={selectedShipments.length === 0 || transferMutation.isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            {transferMutation.isPending ? 'Transferring...' : `Transfer (${selectedShipments.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
