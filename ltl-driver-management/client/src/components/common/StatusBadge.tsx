import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant = 'default' }) => {
  const classes = clsx(
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
    {
      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': variant === 'default',
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': variant === 'success',
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400': variant === 'warning',
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400': variant === 'error',
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400': variant === 'info',
    }
  );

  return <span className={classes}>{status}</span>;
};