import React from 'react';
import { EquipmentStatus } from '../../types';

interface EquipmentStatusBadgeProps {
  status: EquipmentStatus;
}

const statusConfig: Record<EquipmentStatus, { label: string; className: string }> = {
  AVAILABLE: {
    label: 'Available',
    className: 'bg-green-100 text-green-800'
  },
  DISPATCHED: {
    label: 'Dispatched',
    className: 'bg-blue-100 text-blue-800'
  },
  IN_TRANSIT: {
    label: 'In Transit',
    className: 'bg-purple-100 text-purple-800'
  },
  MAINTENANCE: {
    label: 'Maintenance',
    className: 'bg-yellow-100 text-yellow-800'
  },
  OUT_OF_SERVICE: {
    label: 'Out of Service',
    className: 'bg-red-100 text-red-800'
  }
};

export const EquipmentStatusBadge: React.FC<EquipmentStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
};
