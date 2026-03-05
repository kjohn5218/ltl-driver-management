import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, AlertTriangle } from 'lucide-react';
import { loadsheetService } from '../services/loadsheetService';
import { terminalService } from '../services/terminalService';
import { equipmentService } from '../services/equipmentService';
import { linehaulProfileService } from '../services/linehaulProfileService';
import {
  Terminal,
  EquipmentTrailer,
  LinehaulProfile,
  Loadsheet
} from '../types';
import toast from 'react-hot-toast';

interface NewLoadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (loadsheet: Loadsheet) => void;
}

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
              className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm"
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
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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

export const NewLoadsheetModal: React.FC<NewLoadsheetModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const [saving, setSaving] = useState(false);

  // Data sources
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [trailers, setTrailers] = useState<EquipmentTrailer[]>([]);
  const [linehaulProfiles, setLinehaulProfiles] = useState<LinehaulProfile[]>([]);

  // Selected items
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [selectedTrailer, setSelectedTrailer] = useState<EquipmentTrailer | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<LinehaulProfile | null>(null);

  // Form state
  const [manualTrailerNumber, setManualTrailerNumber] = useState('');
  const [trailerLength, setTrailerLength] = useState<number | undefined>(undefined);
  const [pintleHook, setPintleHook] = useState(false);
  const [targetDispatchTime, setTargetDispatchTime] = useState('');
  const [doNotLoadPlacardableHazmat, setDoNotLoadPlacardableHazmat] = useState(false);

  const isInterlineProfile = selectedProfile?.interlineTrailer === true;

  // Filter linehaul profiles based on selected terminal
  const filteredLinehaulProfiles = useMemo(() => {
    if (!selectedTerminal) return linehaulProfiles;
    const terminalCode = selectedTerminal.code.toUpperCase();
    return linehaulProfiles.filter(profile => {
      const profileName = (profile.name || profile.profileCode || '').toUpperCase();
      return profileName.startsWith(terminalCode);
    });
  }, [linehaulProfiles, selectedTerminal]);

  useEffect(() => {
    if (isOpen) {
      fetchTerminals();
      fetchTrailers();
      fetchLinehaulProfiles();
    }
  }, [isOpen]);

  const fetchTerminals = async () => {
    try {
      const terminalsList = await terminalService.getTerminalsList();
      setTerminals(terminalsList);
    } catch (error) {
      console.error('Failed to fetch terminals:', error);
    }
  };

  const fetchTrailers = async () => {
    try {
      const response = await equipmentService.getTrailers({ limit: 2000 });
      setTrailers(response.trailers || []);
    } catch (error) {
      console.error('Failed to fetch trailers:', error);
    }
  };

  const fetchLinehaulProfiles = async () => {
    try {
      const profiles = await linehaulProfileService.getProfilesList();
      setLinehaulProfiles(profiles);
    } catch (error) {
      console.error('Failed to fetch linehaul profiles:', error);
    }
  };

  const getTrailerLength = (trailer: EquipmentTrailer): number => {
    if (trailer.lengthFeet) return trailer.lengthFeet;
    const trailerType = trailer.trailerType || '';
    if (trailerType.includes('28')) return 28;
    if (trailerType.includes('53')) return 53;
    const unitNumber = trailer.unitNumber || '';
    const lengthMatch = unitNumber.match(/(28|40|45|48|53)/);
    if (lengthMatch) return parseInt(lengthMatch[1], 10);
    return 53;
  };

  const handleTerminalSelect = (terminal: Terminal | null) => {
    setSelectedTerminal(terminal);
    if (terminal && selectedProfile) {
      const terminalCode = terminal.code.toUpperCase();
      const profileName = (selectedProfile.name || selectedProfile.profileCode || '').toUpperCase();
      if (!profileName.startsWith(terminalCode)) {
        setSelectedProfile(null);
        setTargetDispatchTime('');
      }
    }
  };

  const handleTrailerSelect = (trailer: EquipmentTrailer | null) => {
    setSelectedTrailer(trailer);
    if (trailer) {
      setTrailerLength(getTrailerLength(trailer));
      setPintleHook(trailer.pintleHook || false);
    } else {
      setTrailerLength(undefined);
      setPintleHook(false);
    }
  };

  const handleProfileSelect = (profile: LinehaulProfile | null) => {
    setSelectedProfile(profile);
    if (profile && profile.standardDepartureTime) {
      setTargetDispatchTime(profile.standardDepartureTime);
    } else {
      setTargetDispatchTime('');
    }
    if (profile?.interlineTrailer) {
      setSelectedTrailer(null);
      setTrailerLength(undefined);
      setPintleHook(false);
    } else {
      setManualTrailerNumber('');
    }
  };

  const resetForm = () => {
    setSelectedTerminal(null);
    setSelectedTrailer(null);
    setSelectedProfile(null);
    setManualTrailerNumber('');
    setTrailerLength(undefined);
    setPintleHook(false);
    setTargetDispatchTime('');
    setDoNotLoadPlacardableHazmat(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      const loadsheet = await loadsheetService.createLoadsheet({
        trailerNumber,
        linehaulName: selectedProfile.name || selectedProfile.profileCode,
        suggestedTrailerLength: trailerLength,
        pintleHookRequired: pintleHook,
        targetDispatchTime: targetDispatchTime || undefined,
        originTerminalId: selectedTerminal.id,
        originTerminalCode: selectedTerminal.code,
        doNotLoadPlacardableHazmat
      });

      toast.success(`Loadsheet ${loadsheet.manifestNumber} created`);
      resetForm();
      onCreated(loadsheet);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create loadsheet');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create New Loadsheet
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Origin Terminal */}
            <TypeToFilterDropdown
              label="Origin Terminal"
              required
              placeholder="Type to search terminals..."
              items={terminals}
              value={selectedTerminal}
              onChange={handleTerminalSelect}
              getDisplayValue={(terminal) => `${terminal.code}${terminal.name ? ` - ${terminal.name}` : ''}`}
              getSearchValue={(terminal) => `${terminal.code} ${terminal.name || ''} ${terminal.city || ''}`}
            />

            {/* Linehaul Name */}
            <TypeToFilterDropdown
              label="Linehaul Name"
              required
              placeholder="Type to search linehauls..."
              items={filteredLinehaulProfiles}
              value={selectedProfile}
              onChange={handleProfileSelect}
              getDisplayValue={(profile) => profile.name || profile.profileCode}
              getSearchValue={(profile) => `${profile.name} ${profile.profileCode} ${profile.origin || ''} ${profile.destination || ''}`}
            />

            {/* Trailer Number */}
            {isInterlineProfile ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trailer Number *
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                    (Interline)
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={manualTrailerNumber}
                  onChange={(e) => setManualTrailerNumber(e.target.value.toUpperCase())}
                  placeholder="Enter interline trailer number..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white text-sm"
                />
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

            {/* Trailer Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trailer Length (ft)
              </label>
              <input
                type="number"
                value={trailerLength || ''}
                onChange={isInterlineProfile ? (e) => setTrailerLength(parseInt(e.target.value) || undefined) : undefined}
                readOnly={!isInterlineProfile}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm ${
                  isInterlineProfile
                    ? 'bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500'
                    : 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed'
                } text-gray-900 dark:text-white`}
                placeholder={isInterlineProfile ? "Enter trailer length" : "Auto-populated"}
              />
            </div>
          </div>

          {/* Hazmat Warning Checkbox */}
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={doNotLoadPlacardableHazmat}
                onChange={(e) => setDoNotLoadPlacardableHazmat(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-yellow-600 rounded focus:ring-yellow-500"
              />
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  Do Not Load Placardable Hazmat
                </span>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? 'Creating...' : 'Create & Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
