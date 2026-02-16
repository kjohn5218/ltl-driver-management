import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import { api } from '../services/api';
import { Location } from '../types';

interface LocationMultiSelectProps {
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  className?: string;
  maxHeight?: string;
  physicalTerminalOnly?: boolean;
}

export const LocationMultiSelect: React.FC<LocationMultiSelectProps> = ({
  value = [],
  onChange,
  placeholder = "Select locations...",
  className = "",
  maxHeight = "max-h-80",
  physicalTerminalOnly = false
}) => {
  // Ensure value is always an array
  const safeValue = Array.isArray(value) ? value : [];

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch all locations on mount or when physicalTerminalOnly changes
  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('limit', '500');
        params.append('active', 'true');
        if (physicalTerminalOnly) {
          params.append('isPhysicalTerminal', 'true');
        }
        const response = await api.get(`/locations?${params.toString()}`);
        setLocations(response.data.locations || response.data || []);
      } catch (error) {
        console.error('Failed to fetch locations:', error);
        setLocations([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, [physicalTerminalOnly]);

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

  // Get selected location objects
  const selectedLocations = useMemo(() => {
    return locations.filter(loc => safeValue.includes(loc.id));
  }, [locations, safeValue]);

  // Clear selections that are no longer valid when locations change (e.g., physicalTerminalOnly filter)
  useEffect(() => {
    if (locations.length > 0 && safeValue.length > 0) {
      const validIds = locations.map(loc => loc.id);
      const validSelections = safeValue.filter(id => validIds.includes(id));
      if (validSelections.length !== safeValue.length) {
        onChange(validSelections);
      }
    }
  }, [locations]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleToggle = (locationId: number) => {
    if (safeValue.includes(locationId)) {
      onChange(safeValue.filter(id => id !== locationId));
    } else {
      onChange([...safeValue, locationId]);
    }
  };

  const handleSelectAll = () => {
    const allIds = filteredLocations.map(loc => loc.id);
    onChange(allIds);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main button/display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-left bg-white dark:bg-gray-700 border rounded-md flex items-center justify-between text-sm
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}
        `}
      >
        <div className="flex-1 min-w-0 truncate">
          {selectedLocations.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          ) : selectedLocations.length <= 3 ? (
            <span className="text-gray-700 dark:text-gray-200">
              {selectedLocations.map(loc => loc.code).join(', ')}
            </span>
          ) : (
            <span className="text-gray-700 dark:text-gray-200">
              {selectedLocations.slice(0, 2).map(loc => loc.code).join(', ')} +{selectedLocations.length - 2} more
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2">
          {safeValue.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Selected count badge */}
      {safeValue.length > 0 && (
        <span className="absolute -top-2 -right-2 text-xs px-1.5 py-0.5 bg-indigo-600 text-white rounded-full">
          {safeValue.length}
        </span>
      )}

      {/* Dropdown */}
      {isOpen && (
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
                onKeyDown={handleKeyDown}
                placeholder="Search locations..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Select all / Clear all */}
          <div className="px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 flex justify-between">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Select all ({filteredLocations.length})
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear all
            </button>
          </div>

          {/* Location list */}
          <div className={`${maxHeight} overflow-y-auto`}>
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
                const isSelected = safeValue.includes(location.id);
                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => handleToggle(location.id)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0
                      ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                    `}
                  >
                    {/* Checkbox */}
                    <div className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center
                      ${isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300 dark:border-gray-500'
                      }
                    `}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
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
  );
};
