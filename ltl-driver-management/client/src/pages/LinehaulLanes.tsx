import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit, Eye, EyeOff, Printer, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { linehaulLaneService, LinehaulLane, LinehaulLaneLocation, LinehaulLaneStep } from '../services/linehaulLaneService';
import { locationService, TerminalLocation } from '../services/locationService';

interface RoutingStepFormData {
  sequence: number;
  terminalLocationId: number;
  transitDays: number;
  departDeadline: string;
}

interface LaneFormData {
  originLocationId: number;
  destinationLocationId: number;
  active: boolean;
  routingSteps: RoutingStepFormData[];
}

export const LinehaulLanes: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters
  const [originFilter, setOriginFilter] = useState<number | null>(null);
  const [hideInactive, setHideInactive] = useState(false);

  // Selection
  const [selectedLaneId, setSelectedLaneId] = useState<number | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLane, setEditingLane] = useState<LinehaulLane | null>(null);
  const [deletingLane, setDeletingLane] = useState<LinehaulLane | null>(null);

  // Fetch all lanes
  const { data: lanesData, isLoading: lanesLoading } = useQuery({
    queryKey: ['linehaul-lanes', originFilter, hideInactive],
    queryFn: () => linehaulLaneService.getLanes({
      originLocationId: originFilter || undefined,
      active: hideInactive ? true : undefined,
      limit: 500
    })
  });

  // Fetch unique origin locations for filter dropdown
  const { data: originLocations } = useQuery({
    queryKey: ['linehaul-lanes-origins'],
    queryFn: () => linehaulLaneService.getOriginLocations()
  });

  // Fetch terminal locations (physical and virtual) for dropdowns
  const { data: terminalLocations } = useQuery({
    queryKey: ['terminal-locations'],
    queryFn: () => locationService.getTerminalLocations()
  });

  const lanes = lanesData?.lanes || [];

  // Get selected lane
  const selectedLane = useMemo(() => {
    return lanes.find(l => l.id === selectedLaneId) || null;
  }, [lanes, selectedLaneId]);

  // Filter lanes by origin (client-side additional filtering if needed)
  const filteredLanes = useMemo(() => {
    let result = lanes;
    if (hideInactive) {
      result = result.filter(l => l.active);
    }
    return result;
  }, [lanes, hideInactive]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: linehaulLaneService.createLane,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linehaul-lanes'] });
      queryClient.invalidateQueries({ queryKey: ['linehaul-lanes-origins'] });
      toast.success('Lane created successfully');
      setShowAddModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create lane');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => linehaulLaneService.updateLane(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linehaul-lanes'] });
      toast.success('Lane updated successfully');
      setEditingLane(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update lane');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: linehaulLaneService.deleteLane,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linehaul-lanes'] });
      queryClient.invalidateQueries({ queryKey: ['linehaul-lanes-origins'] });
      toast.success('Lane deleted successfully');
      setDeletingLane(null);
      if (selectedLaneId === deletingLane?.id) {
        setSelectedLaneId(null);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete lane');
    }
  });

  // Current selected lane index for status bar
  const selectedLaneIndex = filteredLanes.findIndex(l => l.id === selectedLaneId) + 1;
  const selectedStepIndex = selectedLane?.routingSteps?.length ? 1 : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Origin Terminal:
            </label>
            <select
              value={originFilter || ''}
              onChange={(e) => setOriginFilter(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Origins</option>
              {originLocations?.map((loc: LinehaulLaneLocation) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={hideInactive}
              onChange={(e) => setHideInactive(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Hide Inactive
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Lane
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* Main content - Master-Detail layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Lanes list */}
        <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
          {/* Table header */}
          <div className="grid grid-cols-2 gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
            <div>Orig</div>
            <div>Dest</div>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto">
            {lanesLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredLanes.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 text-sm">
                No lanes found
              </div>
            ) : (
              filteredLanes.map((lane) => (
                <div
                  key={lane.id}
                  onClick={() => setSelectedLaneId(lane.id)}
                  className={`grid grid-cols-2 gap-2 px-4 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-700 text-sm ${
                    selectedLaneId === lane.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : lane.active
                        ? 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  <div className="font-medium">{lane.originLocation.code}</div>
                  <div className="flex items-center justify-between">
                    <span>{lane.destinationLocation.code}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLane(lane);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingLane(lane);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Status bar */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            {selectedLaneIndex} of {filteredLanes.length}
          </div>
        </div>

        {/* Right panel - Routing steps */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
          {/* Table header */}
          <div className="grid grid-cols-4 gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
            <div>Seq</div>
            <div>Terminal</div>
            <div>Transit Days</div>
            <div>Depart Deadline</div>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto">
            {!selectedLane ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 text-sm">
                Select a lane to view routing steps
              </div>
            ) : selectedLane.routingSteps.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 text-sm">
                No routing steps defined
              </div>
            ) : (
              selectedLane.routingSteps.map((step) => (
                <div
                  key={step.id}
                  className="grid grid-cols-4 gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div>{step.sequence}</div>
                  <div>{step.terminalLocation.code}</div>
                  <div>{step.transitDays}</div>
                  <div>{step.departDeadline || '-'}</div>
                </div>
              ))
            )}
          </div>

          {/* Status bar */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            {selectedLane ? `${selectedStepIndex} of ${selectedLane.routingSteps.length}` : '-'}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingLane) && (
        <LaneModal
          lane={editingLane}
          locations={terminalLocations || []}
          onSave={(data) => {
            if (editingLane) {
              updateMutation.mutate({ id: editingLane.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingLane(null);
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingLane && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Lane
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete the lane from{' '}
              <span className="font-medium">{deletingLane.originLocation.code}</span> to{' '}
              <span className="font-medium">{deletingLane.destinationLocation.code}</span>?
              This will also delete all routing steps.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingLane(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingLane.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Lane Modal Component
interface LaneModalProps {
  lane: LinehaulLane | null;
  locations: TerminalLocation[];
  onSave: (data: any) => void;
  onClose: () => void;
  isLoading: boolean;
}

const LaneModal: React.FC<LaneModalProps> = ({ lane, locations, onSave, onClose, isLoading }) => {
  const [formData, setFormData] = useState<LaneFormData>(() => {
    if (lane) {
      return {
        originLocationId: lane.originLocationId,
        destinationLocationId: lane.destinationLocationId,
        active: lane.active,
        routingSteps: lane.routingSteps.map(s => ({
          sequence: s.sequence,
          terminalLocationId: s.terminalLocationId,
          transitDays: s.transitDays,
          departDeadline: s.departDeadline || ''
        }))
      };
    }
    return {
      originLocationId: 0,
      destinationLocationId: 0,
      active: true,
      routingSteps: []
    };
  });

  const handleAddStep = () => {
    const nextSequence = formData.routingSteps.length + 1;
    setFormData({
      ...formData,
      routingSteps: [
        ...formData.routingSteps,
        { sequence: nextSequence, terminalLocationId: 0, transitDays: 0, departDeadline: '' }
      ]
    });
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = formData.routingSteps.filter((_, i) => i !== index);
    // Renumber sequences
    const renumbered = newSteps.map((step, i) => ({ ...step, sequence: i + 1 }));
    setFormData({ ...formData, routingSteps: renumbered });
  };

  const handleStepChange = (index: number, field: keyof RoutingStepFormData, value: any) => {
    const newSteps = [...formData.routingSteps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, routingSteps: newSteps });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.originLocationId || !formData.destinationLocationId) {
      toast.error('Please select both origin and destination');
      return;
    }

    // Filter out steps without terminal
    const validSteps = formData.routingSteps
      .filter(s => s.terminalLocationId > 0)
      .map(s => ({
        ...s,
        departDeadline: s.departDeadline || null
      }));

    onSave({
      ...formData,
      routingSteps: validSteps
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {lane ? 'Edit Lane' : 'New Lane'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Origin/Destination */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Origin Terminal
                </label>
                <select
                  value={formData.originLocationId}
                  onChange={(e) => setFormData({ ...formData, originLocationId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value={0}>Select Origin...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Destination Terminal
                </label>
                <select
                  value={formData.destinationLocationId}
                  onChange={(e) => setFormData({ ...formData, destinationLocationId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value={0}>Select Destination...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>

            {/* Routing Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Routing Steps
                </label>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Step
                </button>
              </div>

              {formData.routingSteps.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No routing steps. Click "Add Step" to define the routing sequence.
                </p>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Seq</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Terminal</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Transit Days</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Depart Deadline</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {formData.routingSteps.map((step, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                            {step.sequence}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={step.terminalLocationId}
                              onChange={(e) => handleStepChange(index, 'terminalLocationId', parseInt(e.target.value))}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value={0}>Select...</option>
                              {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={step.transitDays}
                              onChange={(e) => handleStepChange(index, 'transitDays', parseInt(e.target.value) || 0)}
                              min={0}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="time"
                              step="1"
                              value={step.departDeadline}
                              onChange={(e) => handleStepChange(index, 'departDeadline', e.target.value)}
                              className="w-28 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="HH:MM:SS"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(index)}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
