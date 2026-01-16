import React from 'react';
import { clsx } from 'clsx';

interface CapacityBarProps {
  percentage: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const CapacityBar: React.FC<CapacityBarProps> = ({
  percentage,
  showLabel = true,
  size = 'md'
}) => {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  // Determine color based on percentage
  const getColorClass = () => {
    if (clampedPercentage >= 80) return 'bg-green-500';
    if (clampedPercentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const heightClass = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  }[size];

  return (
    <div className="flex items-center gap-2">
      <div className={clsx(
        'flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
        heightClass
      )}>
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300',
            getColorClass()
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-right">
          {clampedPercentage}%
        </span>
      )}
    </div>
  );
};
