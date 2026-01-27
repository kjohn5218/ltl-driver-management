import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import { api } from '../services/api';
import { Location } from '../types';

interface LocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect?: (location: Location | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const LocationSelect: React.FC<LocationSelectProps> = ({
  value,
  onChange,
  onLocationSelect,
  placeholder = "Select location...",
  required = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch all locations on mount
  useEffect(() => {
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
  }, []);

  // Find selected location when value changes
  useEffect(() => {
    if (value && locations.length > 0) {
      const found = locations.find(loc => loc.code === value);
      setSelectedLocation(found || null);
    } else if (!value) {
      setSelectedLocation(null);
    }
  }, [value, locations]);

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

  const handleSelect = (location: Location) => {
    onChange(location.code);
    setSelectedLocation(location);
    if (onLocationSelect) {
      onLocationSelect(location);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSelectedLocation(null);
    if (onLocationSelect) {
      onLocationSelect(null);
    }
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
          ${!value && required ? 'border-red-300' : ''}
        `}
      >
        {selectedLocation ? (
          <div className="flex-1 min-w-0 truncate">
            <span className="font-bold text-blue-600 dark:text-blue-400">{selectedLocation.code}</span>
            {selectedLocation.name && (
              <span className="ml-2 text-gray-700 dark:text-gray-300">{selectedLocation.name}</span>
            )}
            {(selectedLocation.city || selectedLocation.state) && (
              <span className="ml-2 text-gray-400 dark:text-gray-500 text-xs">
                ({selectedLocation.city}{selectedLocation.city && selectedLocation.state ? ', ' : ''}{selectedLocation.state})
              </span>
            )}
          </div>
        ) : value ? (
          <span className="font-medium text-gray-700 dark:text-gray-300">{value}</span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}

        <div className="flex items-center gap-1 ml-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

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

          {/* Location list */}
          <div className="max-h-80 overflow-y-auto">
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
                const isSelected = selectedLocation?.id === location.id;
                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => handleSelect(location)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0
                      ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                    `}
                  >
                    {/* Selection indicator */}
                    <div className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center
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
                          {location.timeZone && <span className="ml-2 text-blue-500 dark:text-blue-400">({location.timeZone})</span>}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Manual entry option */}
          {searchTerm && !filteredLocations.find(l => l.code.toLowerCase() === searchTerm.toLowerCase()) && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-2">
              <button
                type="button"
                onClick={() => {
                  onChange(searchTerm.toUpperCase());
                  if (onLocationSelect) {
                    onLocationSelect(null);
                  }
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className="w-full px-3 py-2 text-left text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md"
              >
                <span className="text-gray-600 dark:text-gray-400">Use custom code: </span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{searchTerm.toUpperCase()}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
