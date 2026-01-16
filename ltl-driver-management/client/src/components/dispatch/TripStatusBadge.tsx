import React from 'react';
import { TripStatus } from '../../types';

interface TripStatusBadgeProps {
  status: TripStatus;
}

const statusConfig: Record<TripStatus, { label: string; className: string }> = {
  PLANNED: {
    label: 'Planned',
    className: 'bg-gray-100 text-gray-800'
  },
  ASSIGNED: {
    label: 'Assigned',
    className: 'bg-blue-100 text-blue-800'
  },
  DISPATCHED: {
    label: 'Dispatched',
    className: 'bg-indigo-100 text-indigo-800'
  },
  IN_TRANSIT: {
    label: 'In Transit',
    className: 'bg-purple-100 text-purple-800'
  },
  ARRIVED: {
    label: 'Arrived',
    className: 'bg-teal-100 text-teal-800'
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800'
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800'
  }
};

export const TripStatusBadge: React.FC<TripStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
};
