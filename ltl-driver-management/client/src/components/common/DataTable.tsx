import React from 'react';
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  header: string;
  accessor: keyof T;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  keyExtractor?: (item: T) => string | number;
  sortBy?: keyof T | null;
  sortDirection?: SortDirection;
  onSort?: (column: keyof T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  keyExtractor = (item) => item.id,
  sortBy = null,
  sortDirection = null,
  onSort
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
            {columns.map((column, index) => (
              <th
                key={index}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${
                  column.sortable && onSort ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none' : ''
                }`}
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
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {columns.map((column, index) => (
                <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {column.cell ? column.cell(item) : item[column.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}