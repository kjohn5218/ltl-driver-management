import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { loadsheetService } from '../services/loadsheetService';
import { terminalService } from '../services/terminalService';
import { equipmentService } from '../services/equipmentService';
import { linehaulProfileService } from '../services/linehaulProfileService';
import {
  Loadsheet,
  LoadsheetStatus,
  Terminal,
  EquipmentTrailer,
  LinehaulProfile,
  CreateLoadsheetRequest
} from '../types';
import { toast } from 'react-hot-toast';
import {
  Save,
  ArrowLeft,
  Download,
  Lock,
  AlertTriangle,
  Search
} from 'lucide-react';

// Type-to-filter dropdown component
interface TypeToFilterProps<T> {
  label: string;
  required?: boolean;
  placeholder?: string;
  items: T[];
  value: T | null;
  onChange: (item: T | null) => void;
  getDisplayValue: (item: T) => string;
  getSearchValue: (item: T) => string;
  disabled?: boolean;
}

function TypeToFilterDropdown<T>({
  label,
  required,
  placeholder,
  items,
  value,
  onChange,
  getDisplayValue,
  getSearchValue,
  disabled
}: TypeToFilterProps<T>) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item => getSearchValue(item).toLowerCase().includes(searchLower));
  }, [items, search, getSearchValue]);

  const handleSelect = (item: T) => {
    onChange(item);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && '*'}
      </label>
      <div className="relative">
        <div className="flex">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={value ? getDisplayValue(value) : search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
                if (value) onChange(null);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder || `Type to search...`}
              disabled={disabled}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
        {isOpen && !value && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                {items.length === 0 ? 'Loading...' : 'No matches found'}
              </div>
            ) : (
              <>
                {filteredItems.slice(0, 50).map((item, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    {getDisplayValue(item)}
                  </button>
                ))}
                {filteredItems.length > 50 && (
                  <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    Type more to narrow results...
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const LoadsheetForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Data sources for type-to-filter dropdowns
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [trailers, setTrailers] = useState<EquipmentTrailer[]>([]);
  const [linehaulProfiles, setLinehaulProfiles] = useState<LinehaulProfile[]>([]);

  // Selected items for type-to-filter
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [selectedTrailer, setSelectedTrailer] = useState<EquipmentTrailer | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<LinehaulProfile | null>(null);

  // Manual trailer entry for interline profiles
  const [manualTrailerNumber, setManualTrailerNumber] = useState<string>('');
  const isInterlineProfile = selectedProfile?.interlineTrailer === true;

  // Form state - simplified for new loadsheet creation
  const [trailerLength, setTrailerLength] = useState<number | undefined>(undefined);
  const [pintleHook, setPintleHook] = useState<boolean>(false);
  const [targetDispatchTime, setTargetDispatchTime] = useState<string>('');
  const [doNotLoadPlacardableHazmat, setDoNotLoadPlacardableHazmat] = useState(false);

  const [manifestNumber, setManifestNumber] = useState<string>('');
  const [status, setStatus] = useState<LoadsheetStatus>('DRAFT');

  useEffect(() => {
    fetchTerminals();
    fetchTrailers();
    fetchLinehaulProfiles();
    if (isEdit && id) {
      fetchLoadsheet(parseInt(id));
    }
  }, [id, isEdit]);

  const fetchTerminals = async () => {
    try {
      const terminalsList = await terminalService.getTerminalsList();
      console.log('Loaded terminals:', terminalsList.length, terminalsList);
      setTerminals(terminalsList);
    } catch (error) {
      console.error('Failed to fetch terminals:', error);
    }
  };

  const fetchTrailers = async () => {
    try {
      const response = await equipmentService.getTrailers({ limit: 500 });
      console.log('Loaded trailers:', response.trailers?.length, response);
      setTrailers(response.trailers || []);
    } catch (error) {
      console.error('Failed to fetch trailers:', error);
    }
  };

  const fetchLinehaulProfiles = async () => {
    try {
      const profiles = await linehaulProfileService.getProfilesList();
      console.log('Loaded linehaul profiles:', profiles.length, profiles);
      setLinehaulProfiles(profiles);
    } catch (error) {
      console.error('Failed to fetch linehaul profiles:', error);
    }
  };

  const fetchLoadsheet = async (loadsheetId: number) => {
    try {
      setLoading(true);
      const loadsheet = await loadsheetService.getLoadsheetById(loadsheetId);

      // Set selected items based on loadsheet data
      if (loadsheet.originTerminalId) {
        const terminal = terminals.find(t => t.id === loadsheet.originTerminalId);
        if (terminal) setSelectedTerminal(terminal);
      }

      // Find trailer by number
      const trailer = trailers.find(t => t.unitNumber === loadsheet.trailerNumber);
      if (trailer) {
        setSelectedTrailer(trailer);
        setTrailerLength(trailer.lengthFeet);
      }

      // Find profile by name
      const profile = linehaulProfiles.find(p => p.name === loadsheet.linehaulName || p.profileCode === loadsheet.linehaulName);
      if (profile) setSelectedProfile(profile);

      setTrailerLength(loadsheet.suggestedTrailerLength);
      setDoNotLoadPlacardableHazmat((loadsheet as any).doNotLoadPlacardableHazmat || false);
      setManifestNumber(loadsheet.manifestNumber);
      setStatus(loadsheet.status);
    } catch (error) {
      toast.error('Failed to load loadsheet');
      navigate('/loadsheets');
    } finally {
      setLoading(false);
    }
  };

  // Auto-populate trailer length and pintle hook when trailer is selected
  const handleTrailerSelect = (trailer: EquipmentTrailer | null) => {
    setSelectedTrailer(trailer);
    if (trailer) {
      setTrailerLength(trailer.lengthFeet);
      setPintleHook(trailer.pintleHook || false);
    } else {
      setTrailerLength(undefined);
      setPintleHook(false);
    }
  };

  // Auto-populate target dispatch time when linehaul profile is selected
  const handleProfileSelect = (profile: LinehaulProfile | null) => {
    setSelectedProfile(profile);
    if (profile && profile.standardDepartureTime) {
      setTargetDispatchTime(profile.standardDepartureTime);
    } else {
      setTargetDispatchTime('');
    }

    // Clear trailer selection when switching between interline and regular profiles
    if (profile?.interlineTrailer) {
      // Switching to interline - clear trailer selection
      setSelectedTrailer(null);
      setTrailerLength(undefined);
      setPintleHook(false);
    } else {
      // Switching to regular - clear manual trailer number
      setManualTrailerNumber('');
    }
  };

  const handleSubmit = async (e: React.FormEvent, newStatus?: LoadsheetStatus) => {
    e.preventDefault();

    // Determine the trailer number based on profile type
    const trailerNumber = isInterlineProfile
      ? manualTrailerNumber.trim()
      : selectedTrailer?.unitNumber;

    if (!trailerNumber) {
      toast.error(isInterlineProfile
        ? 'Please enter a trailer number'
        : 'Please select a trailer');
      return;
    }

    if (!selectedProfile || !selectedTerminal) {
      toast.error('Linehaul name and origin terminal are required');
      return;
    }

    try {
      setSaving(true);

      const dataToSend: CreateLoadsheetRequest & { doNotLoadPlacardableHazmat?: boolean } = {
        trailerNumber,
        linehaulName: selectedProfile.name || selectedProfile.profileCode,
        suggestedTrailerLength: trailerLength,
        pintleHookRequired: pintleHook,
        targetDispatchTime: targetDispatchTime || undefined,
        originTerminalId: selectedTerminal.id,
        originTerminalCode: selectedTerminal.code,
        doNotLoadPlacardableHazmat,
        ...(newStatus && { status: newStatus })
      };

      if (isEdit && id) {
        await loadsheetService.updateLoadsheet(parseInt(id), dataToSend);
        toast.success('Loadsheet updated successfully');
      } else {
        const created = await loadsheetService.createLoadsheet(dataToSend);
        toast.success(`Loadsheet ${created.manifestNumber} created successfully`);
        navigate(`/loadsheets/${created.id}`);
        return;
      }

      if (newStatus) {
        setStatus(newStatus);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save loadsheet');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await loadsheetService.closeLoadsheet(parseInt(id));
      toast.success('Loadsheet closed successfully');
      setStatus('CLOSED');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to close loadsheet');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!id) return;
    try {
      const blob = await loadsheetService.downloadLoadsheet(parseInt(id));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loadsheet-${manifestNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Loadsheet downloaded');
    } catch (error) {
      toast.error('Failed to download loadsheet');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/loadsheets')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <PageHeader
            title={isEdit ? `Loadsheet ${manifestNumber}` : 'New Loadsheet'}
            subtitle={isEdit ? `Status: ${status}` : 'Create a new linehaul loadsheet'}
          />
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          )}
          {isEdit && status !== 'CLOSED' && status !== 'DISPATCHED' && (
            <button
              onClick={handleClose}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Close Loadsheet
            </button>
          )}
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Loadsheet Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Origin Terminal - Type to Filter */}
            <TypeToFilterDropdown
              label="Origin Terminal"
              required
              placeholder="Type to search terminals..."
              items={terminals}
              value={selectedTerminal}
              onChange={setSelectedTerminal}
              getDisplayValue={(terminal) => `${terminal.code}${terminal.name ? ` - ${terminal.name}` : ''}`}
              getSearchValue={(terminal) => `${terminal.code} ${terminal.name || ''} ${terminal.city || ''}`}
            />

            {/* Trailer Number - Conditional based on interline profile */}
            {isInterlineProfile ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trailer Number *
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                    (Interline - Manual Entry)
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={manualTrailerNumber}
                  onChange={(e) => setManualTrailerNumber(e.target.value.toUpperCase())}
                  placeholder="Enter interline trailer number..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
                {selectedProfile?.interlineCarrier && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Carrier: {selectedProfile.interlineCarrier.code} - {selectedProfile.interlineCarrier.name}
                  </p>
                )}
              </div>
            ) : (
              <TypeToFilterDropdown
                label="Trailer Number"
                required
                placeholder="Type to search trailers..."
                items={trailers}
                value={selectedTrailer}
                onChange={handleTrailerSelect}
                getDisplayValue={(trailer) => trailer.unitNumber}
                getSearchValue={(trailer) => `${trailer.unitNumber} ${trailer.trailerType || ''}`}
              />
            )}

            {/* Linehaul Name - Type to Filter */}
            <TypeToFilterDropdown
              label="Linehaul Name"
              required
              placeholder="Type to search linehauls..."
              items={linehaulProfiles}
              value={selectedProfile}
              onChange={handleProfileSelect}
              getDisplayValue={(profile) => profile.name || profile.profileCode}
              getSearchValue={(profile) => `${profile.name} ${profile.profileCode} ${profile.origin || ''} ${profile.destination || ''}`}
            />

            {/* Trailer Length - Auto-populated for fleet trailers, manual for interline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trailer Length (ft)
              </label>
              <input
                type="number"
                value={trailerLength || ''}
                onChange={isInterlineProfile ? (e) => setTrailerLength(parseInt(e.target.value) || undefined) : undefined}
                readOnly={!isInterlineProfile}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${
                  isInterlineProfile
                    ? 'bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500'
                    : 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed'
                } text-gray-900 dark:text-white`}
                placeholder={isInterlineProfile ? "Enter trailer length" : "Auto-populated from trailer"}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isInterlineProfile ? 'Enter manually for interline trailer' : 'Populated from fleet data'}
              </p>
            </div>
          </div>

          {/* Hazmat Warning Checkbox */}
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={doNotLoadPlacardableHazmat}
                onChange={(e) => setDoNotLoadPlacardableHazmat(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-yellow-600 rounded focus:ring-yellow-500"
              />
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Do Not Load Placardable Hazmat
                  </span>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    Check this box to alert the scanning application that quantities of hazardous materials
                    which require a hazmat endorsement to transport may not be loaded on this trailer.
                  </p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/loadsheets')}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || (status === 'CLOSED' || status === 'DISPATCHED')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Loadsheet' : 'Create Loadsheet'}
          </button>
        </div>
      </form>
    </div>
  );
};
