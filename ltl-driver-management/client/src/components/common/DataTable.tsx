import React from 'react';
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  header: string | React.ReactNode;
  accessor: keyof T;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string; // Tailwind width class like 'w-20', 'w-32', 'min-w-[200px]', etc.
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  keyExtractor?: (item: T) => string | number;
  sortBy?: keyof T | null;
  sortDirection?: SortDirection;
  onSort?: (column: keyof T) => void;
  // Selection props
  selectable?: boolean;
  selectedIds?: Set<number>;
  onSelectionChange?: (selectedIds: Set<number>) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  keyExtractor = (item) => item.id,
  sortBy = null,
  sortDirection = null,
  onSort,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange
}: DataTableProps<T>) {
  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;

    if (sortBy === column.accessor) {
      if (sortDirection === 'asc') {
        return <ArrowUp className="w-4 h-4 ml-1 inline-block" />;
      } else if (sortDirection === 'desc') {
        return <ArrowDown className="w-4 h-4 ml-1 inline-block" />;
      }
    }
    return <ArrowUpDown className="w-4 h-4 ml-1 inline-block opacity-40" />;
  };

  // Handle individual row selection
  const handleRowSelect = (id: number, checked: boolean) => {
    if (!onSelectionChange) return;
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    onSelectionChange(newSelection);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const allIds = new Set(data.map(item => keyExtractor(item) as number));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  // Check if all items are selected
  const allSelected = data.length > 0 && data.every(item => selectedIds.has(keyExtractor(item) as number));
  const someSelected = data.some(item => selectedIds.has(keyExtractor(item) as number));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {selectable && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = someSelected && !allSelected;
                    }
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                />
              </th>
            )}
            {columns.map((column, index) => (
              <th
                key={index}
                className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${
                  column.sortable && onSort ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none' : ''
                } ${column.width || ''}`}
                onClick={() => {
                  if (column.sortable && onSort) {
                    onSort(column.accessor);
                  }
                }}
              >
                <span className="flex items-center">
                  {column.header}
                  {renderSortIcon(column)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => {
            const itemId = keyExtractor(item) as number;
            const isSelected = selectedIds.has(itemId);
            return (
              <tr
                key={itemId}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                {selectable && (
                  <td className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleRowSelect(itemId, e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                    />
                  </td>
                )}
                {columns.map((column, index) => (
                  <td key={index} className={`px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${column.width || ''}`}>
                    {column.cell ? column.cell(item) : item[column.accessor]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
