import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Location } from '../types';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect?: (location: Location | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  onLocationSelect,
  placeholder = "Search locations...",
  required = false,
  className = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
}) => {
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Debounced search
  useEffect(() => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/locations/search?q=${encodeURIComponent(value)}`);
        setSuggestions(response.data);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Failed to search locations:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (onLocationSelect) {
      onLocationSelect(null); // Clear selected location when typing
    }
  };

  const handleLocationSelect = (location: Location) => {
    onChange(location.code);
    if (onLocationSelect) {
      onLocationSelect(location);
    }
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0;
        setSelectedIndex(nextIndex);
        suggestionRefs.current[nextIndex]?.scrollIntoView({ block: 'nearest' });
        break;

      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1;
        setSelectedIndex(prevIndex);
        suggestionRefs.current[prevIndex]?.scrollIntoView({ block: 'nearest' });
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleLocationSelect(suggestions[selectedIndex]);
        }
        break;

      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow clicks to register
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        required={required}
        className={className}
      />

      {showSuggestions && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500">
              Searching locations...
            </div>
          ) : (
            suggestions.map((location, index) => (
              <div
                key={location.id}
                ref={(el) => suggestionRefs.current[index] = el}
                className={`px-4 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                  index === selectedIndex 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleLocationSelect(location)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">
                      <span className="text-blue-600 font-bold">{location.code}</span>
                      {location.name && (
                        <span className="ml-2 text-gray-700">{location.name}</span>
                      )}
                    </div>
                    {(location.city || location.state) && (
                      <div className="text-xs text-gray-500">
                        {location.city && location.state 
                          ? `${location.city}, ${location.state}`
                          : location.city || location.state
                        }
                        {location.timeZone && (
                          <span className="ml-2 text-blue-500">({location.timeZone})</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    location.active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {location.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {!isLoading && suggestions.length === 0 && (
            <div className="px-4 py-2 text-sm text-gray-500">
              No locations found. You can enter a custom location code.
            </div>
          )}
        </div>
      )}
    </div>
  );
};