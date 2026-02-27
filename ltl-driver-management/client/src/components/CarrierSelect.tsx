import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X, Search, Check, Truck } from 'lucide-react';
import { api } from '../services/api';
import { Carrier } from '../types';

interface CarrierSelectProps {
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  className?: string;
  showAllOption?: boolean;
  hasDrivers?: boolean; // Only show carriers that have drivers
}

export const CarrierSelect: React.FC<CarrierSelectProps> = ({
  value,
  onChange,
  placeholder = "Select carrier...",
  className = "",
  showAllOption = true,
  hasDrivers = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch active carriers on mount
  useEffect(() => {
    const fetchCarriers = async () => {
      setIsLoading(true);
      try {
        let url = '/carriers?limit=5000&status=ACTIVE';
        if (hasDrivers) {
          url += '&hasDrivers=true';
        }
        const response = await api.get(url);
        const carrierList = response.data.carriers || response.data || [];
        // Sort alphabetically
        carrierList.sort((a: Carrier, b: Carrier) => a.name.localeCompare(b.name));
        setCarriers(carrierList);
      } catch (error) {
        console.error('Failed to fetch carriers:', error);
        setCarriers([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCarriers();
  }, [hasDrivers]);

  // Find selected carrier when value changes
  useEffect(() => {
    if (value && carriers.length > 0) {
      const found = carriers.find(c => c.id === value);
      setSelectedCarrier(found || null);
    } else if (!value) {
      setSelectedCarrier(null);
    }
  }, [value, carriers]);

  // Filter carriers based on search
  const filteredCarriers = useMemo(() => {
    if (!searchTerm.trim()) return carriers;
    const term = searchTerm.toLowerCase();
    return carriers.filter(carrier =>
      carrier.name.toLowerCase().includes(term) ||
      carrier.scacCode?.toLowerCase().includes(term) ||
      carrier.mcNumber?.toLowerCase().includes(term) ||
      carrier.dotNumber?.toLowerCase().includes(term)
    );
  }, [carriers, searchTerm]);

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

  const handleSelect = (carrier: Carrier | null) => {
    if (carrier) {
      onChange(carrier.id);
      setSelectedCarrier(carrier);
    } else {
      onChange('');
      setSelectedCarrier(null);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSelectedCarrier(null);
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
        className={`w-full px-3 py-2 text-left bg-white border rounded-md flex items-center justify-between text-sm
          ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        {selectedCarrier ? (
          <div className="flex items-center gap-2 flex-1 min-w-0 truncate">
            <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="font-medium text-gray-900">{selectedCarrier.name}</span>
            {selectedCarrier.scacCode && (
              <span className="text-gray-500 text-xs">({selectedCarrier.scacCode})</span>
            )}
          </div>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}

        <div className="flex items-center gap-1 ml-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg min-w-[280px]">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search carriers..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Carrier list */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                Loading carriers...
              </div>
            ) : (
              <>
                {/* All Carriers option */}
                {showAllOption && !searchTerm && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-gray-50 border-b border-gray-100
                      ${!value ? 'bg-indigo-50' : ''}
                    `}
                  >
                    <div className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center
                      ${!value ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}
                    `}>
                      {!value && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-gray-700 font-medium">All Carriers</span>
                  </button>
                )}

                {filteredCarriers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">
                    {searchTerm ? 'No carriers found' : 'No active carriers available'}
                  </div>
                ) : (
                  filteredCarriers.map((carrier) => {
                    const isSelected = selectedCarrier?.id === carrier.id;
                    return (
                      <button
                        key={carrier.id}
                        type="button"
                        onClick={() => handleSelect(carrier)}
                        className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0
                          ${isSelected ? 'bg-indigo-50' : ''}
                        `}
                      >
                        {/* Selection indicator */}
                        <div className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center
                          ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}
                        `}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Carrier info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 text-sm">{carrier.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 flex gap-2">
                            {carrier.scacCode && <span>SCAC: {carrier.scacCode}</span>}
                            {carrier.mcNumber && <span>MC: {carrier.mcNumber}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
