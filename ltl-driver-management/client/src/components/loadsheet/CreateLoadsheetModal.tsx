import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { loadsheetService } from '../../services/loadsheetService';
import { terminalService } from '../../services/terminalService';
import { equipmentService } from '../../services/equipmentService';
import { linehaulProfileService } from '../../services/linehaulProfileService';
import {
  Terminal,
  EquipmentTrailer,
  LinehaulProfile,
  CreateLoadsheetRequest,
  Loadsheet,
  DuplicateLoadsheet
} from '../../types';
import { toast } from 'react-hot-toast';
import {
  X,
  Save,
  Download,
  Printer,
  CheckCircle,
  AlertTriangle,
  Search,
  AlertCircle
} from 'lucide-react';
import { DuplicateLoadsheetModal } from './DuplicateLoadsheetModal';

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

interface CreateLoadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateLoadsheetModal: React.FC<CreateLoadsheetModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [saving, setSaving] = useState(false);
  const [createdLoadsheet, setCreatedLoadsheet] = useState<Loadsheet | null>(null);
  const [isReprint, setIsReprint] = useState(false);

  // Duplicate check state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateLoadsheets, setDuplicateLoadsheets] = useState<DuplicateLoadsheet[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Data sources for type-to-filter dropdowns
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [trailers, setTrailers] = useState<EquipmentTrailer[]>([]);
  const [linehaulProfiles, setLinehaulProfiles] = useState<LinehaulProfile[]>([]);

  // Selected items for type-to-filter
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [selectedTrailer, setSelectedTrailer] = useState<EquipmentTrailer | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<LinehaulProfile | null>(null);

  // Filter linehaul profiles based on selected terminal
  // Only show profiles where the name starts with the terminal code
  const filteredLinehaulProfiles = useMemo(() => {
    if (!selectedTerminal) {
      return linehaulProfiles;
    }
    const terminalCode = selectedTerminal.code.toUpperCase();
    return linehaulProfiles.filter(profile => {
      const profileName = (profile.name || profile.profileCode || '').toUpperCase();
      return profileName.startsWith(terminalCode);
    });
  }, [linehaulProfiles, selectedTerminal]);

  // Handle terminal selection - also clear linehaul if it no longer matches
  const handleTerminalSelect = (terminal: Terminal | null) => {
    setSelectedTerminal(terminal);
    // Clear the selected profile if it doesn't match the new terminal filter
    if (terminal && selectedProfile) {
      const terminalCode = terminal.code.toUpperCase();
      const profileName = (selectedProfile.name || selectedProfile.profileCode || '').toUpperCase();
      if (!profileName.startsWith(terminalCode)) {
        setSelectedProfile(null);
        setTargetDispatchTime('');
      }
    }
  };

  // Form state
  const [trailerLength, setTrailerLength] = useState<number | undefined>(undefined);
  const [pintleHook, setPintleHook] = useState<boolean>(false);
  const [targetDispatchTime, setTargetDispatchTime] = useState<string>('');
  const [scheduledDepartDate, setScheduledDepartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [doNotLoadPlacardableHazmat, setDoNotLoadPlacardableHazmat] = useState(false);
  const [doorNumber, setDoorNumber] = useState<string>('');
  const [trailerOutOfService, setTrailerOutOfService] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchTerminals();
      fetchTrailers();
      fetchLinehaulProfiles();
    }
  }, [isOpen]);

  const resetForm = () => {
    setSelectedTerminal(null);
    setSelectedTrailer(null);
    setSelectedProfile(null);
    setTrailerLength(undefined);
    setPintleHook(false);
    setTargetDispatchTime('');
    setScheduledDepartDate(new Date().toISOString().split('T')[0]);
    setDoNotLoadPlacardableHazmat(false);
    setDoorNumber('');
    setCreatedLoadsheet(null);
    setIsReprint(false);
    setShowDuplicateModal(false);
    setDuplicateLoadsheets([]);
    setTrailerOutOfService(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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

  // Get trailer length with fallback based on trailer type or unit number
  const getTrailerLength = (trailer: EquipmentTrailer): number => {
    if (trailer.lengthFeet) return trailer.lengthFeet;

    // Try to detect from trailer type
    const trailerType = trailer.trailerType || '';
    if (trailerType.includes('28')) return 28;
    if (trailerType.includes('53')) return 53;

    // Try to detect from unit number (e.g., "11148S" contains "48")
    const unitNumber = trailer.unitNumber || '';
    const lengthMatch = unitNumber.match(/(28|40|45|48|53)/);
    if (lengthMatch) {
      return parseInt(lengthMatch[1], 10);
    }

    // Default to 53 for standard dry van
    return 53;
  };

  const fetchLinehaulProfiles = async () => {
    try {
      const profiles = await linehaulProfileService.getProfilesList();
      setLinehaulProfiles(profiles);
    } catch (error) {
      console.error('Failed to fetch linehaul profiles:', error);
    }
  };

  // Auto-populate trailer length and pintle hook when trailer is selected
  const handleTrailerSelect = (trailer: EquipmentTrailer | null) => {
    setSelectedTrailer(trailer);
    if (trailer) {
      setTrailerLength(getTrailerLength(trailer));
      setPintleHook(trailer.pintleHook || false);
      // Check if trailer is out of service
      setTrailerOutOfService(trailer.status === 'OUT_OF_SERVICE');
    } else {
      setTrailerLength(undefined);
      setPintleHook(false);
      setTrailerOutOfService(false);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTrailer || !selectedProfile || !selectedTerminal) {
      toast.error('Trailer number, linehaul name, and origin terminal are required');
      return;
    }

    // Prevent creation if trailer is out of service
    if (trailerOutOfService) {
      toast.error('Cannot create loadsheet with an out of service trailer. Contact your supervisor for instructions.');
      return;
    }

    try {
      setCheckingDuplicates(true);

      // First check for duplicate loadsheets
      const duplicateCheck = await loadsheetService.checkDuplicateLoadsheets({
        trailerNumber: selectedTrailer.unitNumber,
        originTerminalCode: selectedTerminal.code
      });

      if (duplicateCheck.hasDuplicates) {
        // Show duplicate modal and let user decide
        setDuplicateLoadsheets(duplicateCheck.duplicates);
        setShowDuplicateModal(true);
        setCheckingDuplicates(false);
        return;
      }

      // No duplicates, proceed with creating the loadsheet
      await createNewLoadsheet();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to check for duplicates');
      setCheckingDuplicates(false);
    }
  };

  const createNewLoadsheet = async () => {
    if (!selectedTrailer || !selectedProfile || !selectedTerminal) {
      return;
    }

    try {
      setSaving(true);
      setCheckingDuplicates(false);

      const dataToSend: CreateLoadsheetRequest & { doNotLoadPlacardableHazmat?: boolean } = {
        trailerNumber: selectedTrailer.unitNumber,
        linehaulName: selectedProfile.name || selectedProfile.profileCode,
        suggestedTrailerLength: trailerLength,
        pintleHookRequired: pintleHook,
        targetDispatchTime: targetDispatchTime || undefined,
        scheduledDepartDate: scheduledDepartDate || undefined,
        originTerminalId: selectedTerminal.id,
        originTerminalCode: selectedTerminal.code,
        doNotLoadPlacardableHazmat,
        doorNumber: doorNumber || undefined
      };

      const created = await loadsheetService.createLoadsheet(dataToSend);
      toast.success(`Loadsheet ${created.manifestNumber} created successfully`);
      setCreatedLoadsheet(created);
      setIsReprint(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create loadsheet');
    } finally {
      setSaving(false);
    }
  };

  const handleContinueCreate = () => {
    setShowDuplicateModal(false);
    createNewLoadsheet();
  };

  const handleReprintSelected = async (loadsheet: DuplicateLoadsheet) => {
    // Close duplicate modal and show the success state with the selected loadsheet
    setShowDuplicateModal(false);

    try {
      // Fetch the full loadsheet data
      const fullLoadsheet = await loadsheetService.getLoadsheetById(loadsheet.id);
      setCreatedLoadsheet(fullLoadsheet);
      setIsReprint(true);
    } catch (error) {
      toast.error('Failed to load existing loadsheet');
    }
  };

  const handleDownload = async () => {
    if (!createdLoadsheet) return;
    try {
      const blob = await loadsheetService.downloadLoadsheet(createdLoadsheet.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loadsheet-${createdLoadsheet.manifestNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Loadsheet downloaded');
    } catch (error) {
      toast.error('Failed to download loadsheet');
    }
  };

  const handlePrint = async () => {
    if (!createdLoadsheet) return;
    try {
      const blob = await loadsheetService.downloadLoadsheet(createdLoadsheet.id);
      const url = window.URL.createObjectURL(blob);

      // Create a hidden iframe to print the PDF
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = url;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          // Clean up after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 1000);
        }, 500);
      };
    } catch (error) {
      toast.error('Failed to print loadsheet');
    }
  };

  return (
    <>
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={handleClose}
                  >
                    <span className="sr-only">Close</span>
                    <X className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {createdLoadsheet ? (
                  // Success State
                  <div className="text-center py-6">
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                    <Dialog.Title as="h3" className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {isReprint ? 'Existing Loadsheet Selected' : 'Loadsheet Created Successfully'}
                    </Dialog.Title>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      Manifest Number: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{createdLoadsheet.manifestNumber}</span>
                      {isReprint && (
                        <span className="block text-sm mt-1 text-gray-500 dark:text-gray-400">
                          You can download or print this existing loadsheet below.
                        </span>
                      )}
                    </p>

                    <div className="flex justify-center gap-4 mb-6">
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-5 h-5" />
                        Download PDF
                      </button>
                      <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Printer className="w-5 h-5" />
                        Print
                      </button>
                    </div>

                    <button
                      onClick={handleClose}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  // Form State
                  <>
                    <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                      Create New Loadsheet
                    </Dialog.Title>

                    <form onSubmit={handleSubmit} className="space-y-6">
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

                        {/* Trailer Number */}
                        <div>
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
                          {/* Out of Service Warning */}
                          {trailerOutOfService && (
                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="text-sm font-medium text-red-800 dark:text-red-200">
                                    Equipment Out of Service
                                  </span>
                                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    The selected trailer is currently out of service. Contact your supervisor for instructions before proceeding.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

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

                        {/* Trailer Length */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Trailer Length (ft)
                          </label>
                          <input
                            type="number"
                            value={trailerLength || ''}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
                            placeholder="Auto-populated from trailer"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Populated from fleet data
                          </p>
                        </div>

                        {/* Door Number */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Door Number
                          </label>
                          <input
                            type="text"
                            value={doorNumber}
                            onChange={(e) => setDoorNumber(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter door number"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Loading door location for scanners
                          </p>
                        </div>

                        {/* Scheduled Depart Date */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Scheduled Depart Date
                          </label>
                          <input
                            type="date"
                            value={scheduledDepartDate}
                            onChange={(e) => setScheduledDepartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Hazmat Warning Checkbox */}
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
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

                      {/* Form Actions */}
                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving || checkingDuplicates || trailerOutOfService}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          {checkingDuplicates ? 'Checking...' : saving ? 'Creating...' : 'Create Loadsheet'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>

    {/* Duplicate Loadsheet Warning Modal */}
    <DuplicateLoadsheetModal
      isOpen={showDuplicateModal}
      onClose={() => setShowDuplicateModal(false)}
      duplicates={duplicateLoadsheets}
      trailerNumber={selectedTrailer?.unitNumber || ''}
      onReprintSelected={handleReprintSelected}
      onContinueCreate={handleContinueCreate}
    />
  </>
  );
};
