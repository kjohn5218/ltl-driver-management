import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { StatusBadge } from '../components/common/StatusBadge';
import { Search } from '../components/common/Search';
import { Modal } from '../components/common/Modal';
import { LinehaulProfileForm } from '../components/linehaulProfiles/LinehaulProfileForm';
import { linehaulProfileService } from '../services/linehaulProfileService';
import { terminalService } from '../services/terminalService';
import { LinehaulProfile, Terminal } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  Clock,
  Route,
  Users,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export const LinehaulProfiles: React.FC = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<LinehaulProfile[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');
  const [terminalFilter, setTerminalFilter] = useState<number | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<LinehaulProfile | null>(null);
  const [duplicateCode, setDuplicateCode] = useState('');
  const [duplicateName, setDuplicateName] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    fetchTerminals();
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [currentPage, searchTerm, activeFilter, terminalFilter]);

  const fetchTerminals = async () => {
    try {
      const data = await terminalService.getTerminalsList();
      setTerminals(data);
    } catch (error) {
      console.error('Failed to fetch terminals:', error);
    }
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await linehaulProfileService.getProfiles({
        search: searchTerm || undefined,
        active: activeFilter === '' ? undefined : activeFilter,
        originTerminalId: terminalFilter || undefined,
        page: currentPage,
        limit: 20
      });
      setProfiles(response.profiles);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to fetch linehaul profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCreate = async (data: Partial<LinehaulProfile>) => {
    try {
      await linehaulProfileService.createProfile(data);
      toast.success('Profile created successfully');
      setIsCreateModalOpen(false);
      fetchProfiles();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create profile');
    }
  };

  const handleUpdate = async (data: Partial<LinehaulProfile>) => {
    if (!selectedProfile) return;
    try {
      await linehaulProfileService.updateProfile(selectedProfile.id, data);
      toast.success('Profile updated successfully');
      setIsEditModalOpen(false);
      fetchProfiles();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleDelete = async () => {
    if (!selectedProfile) return;
    try {
      await linehaulProfileService.deleteProfile(selectedProfile.id);
      toast.success('Profile deleted successfully');
      setIsDeleteModalOpen(false);
      fetchProfiles();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete profile');
    }
  };

  const handleDuplicate = async () => {
    if (!selectedProfile || !duplicateCode) return;
    try {
      await linehaulProfileService.duplicateProfile(
        selectedProfile.id,
        duplicateCode,
        duplicateName || undefined
      );
      toast.success('Profile duplicated successfully');
      setIsDuplicateModalOpen(false);
      setDuplicateCode('');
      setDuplicateName('');
      fetchProfiles();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to duplicate profile');
    }
  };

  const formatTransitTime = (minutes: number | null | undefined) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'profileCode' as keyof LinehaulProfile,
      cell: (profile: LinehaulProfile) => (
        <div className="font-medium text-gray-900">{profile.profileCode}</div>
      )
    },
    {
      header: 'Route',
      accessor: 'name' as keyof LinehaulProfile,
      cell: (profile: LinehaulProfile) => (
        <div>
          <div className="font-medium text-gray-900">{profile.name}</div>
          <div className="flex items-center text-sm text-gray-500">
            <span>{profile.originTerminal?.code}</span>
            <ArrowRight className="w-3 h-3 mx-1" />
            <span>{profile.destinationTerminal?.code}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Distance',
      accessor: 'distanceMiles' as keyof LinehaulProfile,
      cell: (profile: LinehaulProfile) => (
        <div className="flex items-center text-gray-600">
          <Route className="w-4 h-4 mr-1" />
          {profile.distanceMiles ? `${profile.distanceMiles} mi` : '-'}
        </div>
      )
    },
    {
      header: 'Transit Time',
      accessor: 'transitTimeMinutes' as keyof LinehaulProfile,
      cell: (profile: LinehaulProfile) => (
        <div className="flex items-center text-gray-600">
          <Clock className="w-4 h-4 mr-1" />
          {formatTransitTime(profile.transitTimeMinutes)}
        </div>
      )
    },
    {
      header: 'Schedule',
      accessor: 'standardDepartureTime' as keyof LinehaulProfile,
      cell: (profile: LinehaulProfile) => (
        <div className="text-sm">
          <div>{profile.standardDepartureTime || '-'} Dep</div>
          <div>{profile.standardArrivalTime || '-'} Arr</div>
        </div>
      )
    },
    {
      header: 'Requirements',
      accessor: 'requiresTeamDriver' as keyof LinehaulProfile,
      cell: (profile: LinehaulProfile) => (
        <div className="flex flex-wrap gap-1">
          {profile.requiresTeamDriver && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              <Users className="w-3 h-3 mr-1" />
              Team
            </span>
          )}
          {profile.hazmatRequired && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Hazmat
            </span>
          )}
          {!profile.requiresTeamDriver && !profile.hazmatRequired && (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'active' as keyof LinehaulProfile,
      cell: (profile: LinehaulProfile) => (
        <StatusBadge
          status={profile.active ? 'Active' : 'Inactive'}
          variant={profile.active ? 'success' : 'default'}
        />
      )
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessor: 'id' as keyof LinehaulProfile,
            cell: (profile: LinehaulProfile) => (
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedProfile(profile);
                    setDuplicateCode(`${profile.profileCode}-COPY`);
                    setDuplicateName(`${profile.name} (Copy)`);
                    setIsDuplicateModalOpen(true);
                  }}
                  className="text-gray-600 hover:text-gray-900"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedProfile(profile);
                    setIsEditModalOpen(true);
                  }}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedProfile(profile);
                    setIsDeleteModalOpen(true);
                  }}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          }
        ]
      : [])
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Linehaul Profiles"
        subtitle="Manage route profiles for linehaul dispatch"
      />

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 flex-1">
              <div className="flex-1 max-w-md">
                <Search
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Search by code or name..."
                />
              </div>

              <select
                value={activeFilter === '' ? '' : activeFilter.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setActiveFilter(value === '' ? '' : value === 'true');
                  setCurrentPage(1);
                }}
                className="rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">All Profiles</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>

              <select
                value={terminalFilter}
                onChange={(e) => {
                  setTerminalFilter(e.target.value ? parseInt(e.target.value) : '');
                  setCurrentPage(1);
                }}
                className="rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">All Terminals</option>
                {terminals.map((terminal) => (
                  <option key={terminal.id} value={terminal.id}>
                    {terminal.code} - {terminal.name}
                  </option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Profile
              </button>
            )}
          </div>
        </div>

        <DataTable columns={columns} data={profiles} loading={loading} />

        {!loading && profiles.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Create Profile Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Profile"
      >
        <LinehaulProfileForm
          terminals={terminals}
          onSubmit={handleCreate}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
      >
        <LinehaulProfileForm
          profile={selectedProfile}
          terminals={terminals}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Duplicate Profile Modal */}
      <Modal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        title="Duplicate Profile"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Create a copy of <span className="font-medium">{selectedProfile?.profileCode}</span>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">New Profile Code *</label>
            <input
              type="text"
              required
              value={duplicateCode}
              onChange={(e) => setDuplicateCode(e.target.value.toUpperCase())}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">New Profile Name</label>
            <input
              type="text"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <p className="text-sm text-gray-500">
            The new profile will be created as inactive.
          </p>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setIsDuplicateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleDuplicate}
              disabled={!duplicateCode}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
            >
              Duplicate
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Profile"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete this linehaul profile?
          </p>
          <div className="bg-gray-50 p-4 rounded">
            <p className="font-medium">{selectedProfile?.profileCode}</p>
            <p className="text-sm text-gray-600">{selectedProfile?.name}</p>
            <p className="text-sm text-gray-500">
              {selectedProfile?.originTerminal?.code} to {selectedProfile?.destinationTerminal?.code}
            </p>
          </div>
          {selectedProfile?._count?.linehaulTrips && selectedProfile._count.linehaulTrips > 0 && (
            <p className="text-sm text-red-600">
              Warning: This profile has {selectedProfile._count.linehaulTrips} associated trips.
            </p>
          )}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
