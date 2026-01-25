import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for persisting filter state to localStorage
 * @param key - Unique key for localStorage (e.g., 'dispatch-filters')
 * @param defaultFilters - Default filter values
 * @returns [filters, setFilters, updateFilter, resetFilters]
 */
export function usePersistedFilters<T extends Record<string, any>>(
  key: string,
  defaultFilters: T
): [T, React.Dispatch<React.SetStateAction<T>>, (field: keyof T, value: T[keyof T]) => void, () => void] {
  // Initialize state from localStorage or defaults
  const [filters, setFilters] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle any new fields added later
        return { ...defaultFilters, ...parsed };
      }
    } catch (error) {
      console.error(`Failed to load filters from localStorage for key "${key}":`, error);
    }
    return defaultFilters;
  });

  // Persist to localStorage whenever filters change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(filters));
    } catch (error) {
      console.error(`Failed to save filters to localStorage for key "${key}":`, error);
    }
  }, [key, filters]);

  // Helper to update a single filter field
  const updateFilter = useCallback((field: keyof T, value: T[keyof T]) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, [defaultFilters]);

  return [filters, setFilters, updateFilter, resetFilters];
}

/**
 * Hook for persisting a single filter value to localStorage
 * @param key - Unique key for localStorage
 * @param defaultValue - Default value
 * @returns [value, setValue]
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error(`Failed to load state from localStorage for key "${key}":`, error);
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save state to localStorage for key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
}
