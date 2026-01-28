import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X, Search, Check, Building2 } from 'lucide-react';
import { locationService, TerminalLocation } from '../services/locationService';

interface TerminalMultiSelectProps {
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  className?: string;
  maxHeight?: string;
  showPhysicalFilter?: boolean; // Whether to show the "Physical terminals only" checkbox
  label?: string; // Optional label to display above the dropdown
}

export const TerminalMultiSelect: React.FC<TerminalMultiSelectProps> = ({
  value = [],
  onChange,
  placeholder = "Select terminals...",
  className = "",
  maxHeight = "max-h-80",
  showPhysicalFilter = false,
  label
}) => {
  // Ensure value is always an array
  const safeValue = Array.isArray(value) ? value : [];

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [terminals, setTerminals] = useState<TerminalLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [physicalOnly, setPhysicalOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch terminal locations on mount
  useEffect(() => {
    const fetchTerminals = async () => {
      setIsLoading(true);
      try {
        const data = await locationService.getTerminalLocations();
        setTerminals(data || []);
      } catch (error) {
        console.error('Failed to fetch terminals:', error);
        setTerminals([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTerminals();
  }, []);

  // Filter terminals based on search and physical filter
  const filteredTerminals = useMemo(() => {
    let filtered = terminals;

    // Apply physical terminal filter
    if (physicalOnly) {
      filtered = filtered.filter(t => t.isPhysicalTerminal);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.code.toLowerCase().includes(term) ||
        t.name?.toLowerCase().includes(term) ||
        t.city?.toLowerCase().includes(term) ||
        t.state?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [terminals, searchTerm, physicalOnly]);

  // Get selected terminal objects
  const selectedTerminals = useMemo(() => {
    return terminals.filter(t => safeValue.includes(t.id));
  }, [terminals, safeValue]);

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

  const handleToggle = (terminalId: number) => {
    if (safeValue.includes(terminalId)) {
      onChange(safeValue.filter(id => id !== terminalId));
    } else {
      onChange([...safeValue, terminalId]);
    }
  };

  const handleSelectAll = () => {
    const allIds = filteredTerminals.map(t => t.id);
    // Merge with existing selections that aren't in the filtered list
    const existingNotFiltered = safeValue.filter(id => !filteredTerminals.find(t => t.id === id));
    onChange([...existingNotFiltered, ...allIds]);
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
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div ref={containerRef} className="relative">
        {/* Main button/display */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3 py-2 text-left bg-white dark:bg-gray-700 border rounded-md flex items-center justify-between text-sm
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}
          `}
        >
          <div className="flex-1 min-w-0 truncate">
            {selectedTerminals.length === 0 ? (
              <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
            ) : selectedTerminals.length <= 3 ? (
              <span className="text-gray-700 dark:text-gray-200">
                {selectedTerminals.map(t => t.code).join(', ')}
              </span>
            ) : (
              <span className="text-gray-700 dark:text-gray-200">
                {selectedTerminals.slice(0, 2).map(t => t.code).join(', ')} +{selectedTerminals.length - 2} more
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
                  placeholder="Search terminals..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Physical terminals filter */}
            {showPhysicalFilter && (
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={physicalOnly}
                    onChange={(e) => setPhysicalOnly(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Physical terminals only</span>
                </label>
              </div>
            )}

            {/* Select all / Clear all */}
            <div className="px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 flex justify-between">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Select all ({filteredTerminals.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear all
              </button>
            </div>

            {/* Terminal list */}
            <div className={`${maxHeight} overflow-y-auto`}>
              {isLoading ? (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Loading terminals...
                </div>
              ) : filteredTerminals.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {searchTerm || physicalOnly ? 'No terminals found' : 'No terminals available'}
                </div>
              ) : (
                filteredTerminals.map((terminal) => {
                  const isSelected = safeValue.includes(terminal.id);
                  return (
                    <button
                      key={terminal.id}
                      type="button"
                      onClick={() => handleToggle(terminal.id)}
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

                      {/* Terminal info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">{terminal.code}</span>
                          {terminal.name && (
                            <span className="text-gray-700 dark:text-gray-300 text-sm truncate">{terminal.name}</span>
                          )}
                          {terminal.isPhysicalTerminal && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                              Physical
                            </span>
                          )}
                          {terminal.isVirtualTerminal && !terminal.isPhysicalTerminal && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                              Virtual
                            </span>
                          )}
                        </div>
                        {(terminal.city || terminal.state) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {terminal.city}{terminal.city && terminal.state ? ', ' : ''}{terminal.state}
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
  );
};
