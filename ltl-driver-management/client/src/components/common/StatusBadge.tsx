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
      'bg-gray-100 text-gray-800': variant === 'default',
      'bg-green-100 text-green-800': variant === 'success',
      'bg-yellow-100 text-yellow-800': variant === 'warning',
      'bg-red-100 text-red-800': variant === 'error',
      'bg-blue-100 text-blue-800': variant === 'info',
    }
  );

  return <span className={classes}>{status}</span>;
};