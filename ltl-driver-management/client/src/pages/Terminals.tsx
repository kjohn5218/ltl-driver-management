import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { StatusBadge } from '../components/common/StatusBadge';
import { Search } from '../components/common/Search';
import { Modal } from '../components/common/Modal';
import { TerminalForm } from '../components/terminals/TerminalForm';
import { terminalService } from '../services/terminalService';
import { Terminal } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  Clock,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export const Terminals: React.FC = () => {
  const { user } = useAuth();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    fetchTerminals();
  }, [currentPage, searchTerm, activeFilter]);

  const fetchTerminals = async () => {
    try {
      setLoading(true);
      const response = await terminalService.getTerminals({
        search: searchTerm || undefined,
        active: activeFilter === '' ? undefined : activeFilter,
        page: currentPage,
        limit: 20
      });
      setTerminals(response.terminals);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to fetch terminals');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCreate = async (data: Partial<Terminal>) => {
    try {
      await terminalService.createTerminal(data);
      toast.success('Terminal created successfully');
      setIsCreateModalOpen(false);
      fetchTerminals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create terminal');
    }
  };

  const handleUpdate = async (data: Partial<Terminal>) => {
    if (!selectedTerminal) return;
    try {
      await terminalService.updateTerminal(selectedTerminal.id, data);
      toast.success('Terminal updated successfully');
      setIsEditModalOpen(false);
      fetchTerminals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update terminal');
    }
  };

  const handleDelete = async () => {
    if (!selectedTerminal) return;
    try {
      await terminalService.deleteTerminal(selectedTerminal.id);
      toast.success('Terminal deleted successfully');
      setIsDeleteModalOpen(false);
      fetchTerminals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete terminal');
    }
  };

  const handleToggleStatus = async (terminal: Terminal) => {
    try {
      await terminalService.toggleTerminalStatus(terminal.id);
      toast.success(`Terminal ${terminal.active ? 'deactivated' : 'activated'} successfully`);
      fetchTerminals();
    } catch (error) {
      toast.error('Failed to update terminal status');
    }
  };

  const columns = [
    {
      header: 'Code',
      accessor: 'code' as keyof Terminal,
      cell: (terminal: Terminal) => (
        <div className="font-medium text-gray-900">{terminal.code}</div>
      )
    },
    {
      header: 'Name',
      accessor: 'name' as keyof Terminal,
      cell: (terminal: Terminal) => (
        <button
          onClick={() => {
            setSelectedTerminal(terminal);
            setIsDetailsModalOpen(true);
          }}
          className="text-indigo-600 hover:text-indigo-900 font-medium"
        >
          {terminal.name}
        </button>
      )
    },
    {
      header: 'Location',
      accessor: 'city' as keyof Terminal,
      cell: (terminal: Terminal) => (
        <div className="flex items-center text-gray-600">
          <MapPin className="w-4 h-4 mr-1" />
          {terminal.city}, {terminal.state}
        </div>
      )
    },
    {
      header: 'Phone',
      accessor: 'phone' as keyof Terminal,
      cell: (terminal: Terminal) => (
        <div className="flex items-center text-gray-600">
          {terminal.phone ? (
            <>
              <Phone className="w-4 h-4 mr-1" />
              {terminal.phone}
            </>
          ) : (
            '-'
          )}
        </div>
      )
    },
    {
      header: 'Timezone',
      accessor: 'timezone' as keyof Terminal,
      cell: (terminal: Terminal) => {
        const tzLabels: Record<string, string> = {
          'America/Los_Angeles': 'PT',
          'America/Denver': 'MT',
          'America/Chicago': 'CT',
          'America/New_York': 'ET'
        };
        return (
          <div className="flex items-center text-gray-600">
            <Clock className="w-4 h-4 mr-1" />
            {tzLabels[terminal.timezone] || terminal.timezone}
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'active' as keyof Terminal,
      cell: (terminal: Terminal) => (
        <StatusBadge
          status={terminal.active ? 'Active' : 'Inactive'}
          variant={terminal.active ? 'success' : 'default'}
        />
      )
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessor: 'id' as keyof Terminal,
            cell: (terminal: Terminal) => (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleToggleStatus(terminal)}
                  className="text-gray-600 hover:text-gray-900"
                  title={terminal.active ? 'Deactivate' : 'Activate'}
                >
                  {terminal.active ? (
                    <ToggleRight className="w-4 h-4 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setSelectedTerminal(terminal);
                    setIsEditModalOpen(true);
                  }}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedTerminal(terminal);
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
        title="Terminals"
        subtitle="Manage terminal locations and equipment requirements"
      />

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 flex-1">
              <div className="flex-1 max-w-md">
                <Search
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Search by code, name, or city..."
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
                <option value="">All Terminals</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Terminal
              </button>
            )}
          </div>
        </div>

        <DataTable columns={columns} data={terminals} loading={loading} />

        {!loading && terminals.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Create Terminal Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Terminal"
      >
        <TerminalForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit Terminal Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Terminal"
      >
        <TerminalForm
          terminal={selectedTerminal}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Terminal Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Terminal Details"
      >
        {selectedTerminal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Code</label>
                <p className="text-gray-900 font-medium">{selectedTerminal.code}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Name</label>
                <p className="text-gray-900">{selectedTerminal.name}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">Address</label>
              <p className="text-gray-900">
                {selectedTerminal.address && <>{selectedTerminal.address}<br /></>}
                {selectedTerminal.city}, {selectedTerminal.state} {selectedTerminal.zipCode}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Phone</label>
                <p className="text-gray-900 flex items-center">
                  {selectedTerminal.phone ? (
                    <>
                      <Phone className="w-4 h-4 mr-1" />
                      {selectedTerminal.phone}
                    </>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900 flex items-center">
                  {selectedTerminal.email ? (
                    <>
                      <Mail className="w-4 h-4 mr-1" />
                      {selectedTerminal.email}
                    </>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Timezone</label>
                <p className="text-gray-900 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {selectedTerminal.timezone}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Status</label>
                <StatusBadge
                  status={selectedTerminal.active ? 'Active' : 'Inactive'}
                  variant={selectedTerminal.active ? 'success' : 'default'}
                />
              </div>
            </div>

            {selectedTerminal.equipmentRequirements && selectedTerminal.equipmentRequirements.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Equipment Requirements
                </label>
                <div className="bg-gray-50 rounded-md p-3">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left pb-2">Equipment Type</th>
                        <th className="text-center pb-2">Min Count</th>
                        <th className="text-center pb-2">Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTerminal.equipmentRequirements.map((req) => (
                        <tr key={req.id} className="border-t border-gray-200">
                          <td className="py-1 font-medium">{req.equipmentType}</td>
                          <td className="py-1 text-center">{req.minCount}</td>
                          <td className="py-1 text-center">{req.dayOfWeek != null ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][req.dayOfWeek] : 'All'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Terminal"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete this terminal?
          </p>
          <div className="bg-gray-50 p-4 rounded">
            <p className="font-medium">{selectedTerminal?.code} - {selectedTerminal?.name}</p>
            <p className="text-sm text-gray-600">
              {selectedTerminal?.city}, {selectedTerminal?.state}
            </p>
          </div>
          <p className="text-sm text-red-600">
            Warning: This will also remove any associated linehaul profiles and equipment assignments.
          </p>
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
