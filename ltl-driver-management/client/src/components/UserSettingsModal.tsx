import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, MapPin, Settings, Check } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Location } from '../types';
import { toast } from 'react-hot-toast';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    user?.homeLocationId || null
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch locations on mount
  useEffect(() => {
    if (isOpen) {
      const fetchLocations = async () => {
        setIsLoading(true);
        try {
          const response = await api.get('/locations?limit=500&active=true');
          setLocations(response.data.locations || response.data || []);
        } catch (error) {
          console.error('Failed to fetch locations:', error);
          setLocations([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchLocations();
      setSelectedLocationId(user?.homeLocationId || null);
    }
  }, [isOpen, user?.homeLocationId]);

  // Filter locations based on search
  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return locations;
    const term = searchTerm.toLowerCase();
    return locations.filter(loc =>
      loc.code.toLowerCase().includes(term) ||
      loc.name?.toLowerCase().includes(term) ||
      loc.city?.toLowerCase().includes(term) ||
      loc.state?.toLowerCase().includes(term)
    );
  }, [locations, searchTerm]);

  // Get selected location object
  const selectedLocation = useMemo(() => {
    return locations.find(loc => loc.id === selectedLocationId) || null;
  }, [locations, selectedLocationId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isDropdownOpen]);

  const handleSelectLocation = (locationId: number | null) => {
    setSelectedLocationId(locationId);
    setIsDropdownOpen(false);
    setSearchTerm('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ homeLocationId: selectedLocationId });
      toast.success('Settings saved successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* User info */}
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Logged in as</p>
            <p className="font-medium text-gray-900 dark:text-white">{user?.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">{user?.email}</p>
          </div>

          {/* Home Location Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MapPin className="inline-block w-4 h-4 mr-1" />
              Home Location
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Your home location will be used as the default filter on the Dispatch Board.
            </p>

            {/* Location dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full px-3 py-2 text-left bg-white dark:bg-gray-700 border rounded-md flex items-center justify-between text-sm
                  ${isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}
                `}
              >
                <div className="flex-1 min-w-0">
                  {selectedLocation ? (
                    <span className="text-gray-900 dark:text-white">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{selectedLocation.code}</span>
                      {selectedLocation.name && ` - ${selectedLocation.name}`}
                      {(selectedLocation.city || selectedLocation.state) && (
                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                          ({selectedLocation.city}{selectedLocation.city && selectedLocation.state ? ', ' : ''}{selectedLocation.state})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">No home location selected</span>
                  )}
                </div>
                {selectedLocation && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectLocation(null);
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded ml-2"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </button>

              {/* Dropdown */}
              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                  {/* Search input */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search locations..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Location list */}
                  <div className="max-h-60 overflow-y-auto">
                    {isLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Loading locations...
                      </div>
                    ) : filteredLocations.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        {searchTerm ? 'No locations found' : 'No locations available'}
                      </div>
                    ) : (
                      filteredLocations.map((location) => {
                        const isSelected = location.id === selectedLocationId;
                        return (
                          <button
                            key={location.id}
                            type="button"
                            onClick={() => handleSelectLocation(location.id)}
                            className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0
                              ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                            `}
                          >
                            {/* Check mark */}
                            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                              {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                            </div>

                            {/* Location info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">{location.code}</span>
                                {location.name && (
                                  <span className="text-gray-700 dark:text-gray-300 text-sm truncate">{location.name}</span>
                                )}
                              </div>
                              {(location.city || location.state) && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {location.city}{location.city && location.state ? ', ' : ''}{location.state}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
