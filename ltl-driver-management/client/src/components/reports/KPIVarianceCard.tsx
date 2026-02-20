import React from 'react';
import { clsx } from 'clsx';

export type KPIFormat = 'currency' | 'percent' | 'number' | 'miles' | 'minutes';
export type VarianceType = 'positive-good' | 'negative-good';

interface KPIVarianceCardProps {
  title: string;
  value: number | null;
  format?: KPIFormat;
  variance?: number | null;
  varianceType?: VarianceType;
  isVarianceCard?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const formatValue = (value: number | null, format: KPIFormat): string => {
  if (value === null || value === undefined) return 'N/A';

  switch (format) {
    case 'currency':
      if (Math.abs(value) >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
      } else if (Math.abs(value) >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
      }
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'miles':
      if (Math.abs(value) >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
      } else if (Math.abs(value) >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();
    case 'minutes':
      return value.toFixed(2);
    case 'number':
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
};

const formatVariance = (variance: number | null, format: KPIFormat): string => {
  if (variance === null || variance === undefined) return 'N/A';

  const prefix = variance >= 0 ? '' : '';

  switch (format) {
    case 'currency':
      if (variance < 0) {
        return `($${Math.abs(variance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
      }
      return `$${variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${prefix}${variance.toFixed(2)}%`;
    case 'miles':
      return variance.toLocaleString(undefined, { maximumFractionDigits: 2 });
    case 'minutes':
      return variance.toFixed(2);
    case 'number':
    default:
      return variance.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
};

export const KPIVarianceCard: React.FC<KPIVarianceCardProps> = ({
  title,
  value,
  format = 'number',
  variance,
  varianceType = 'positive-good',
  isVarianceCard = false,
  size = 'md',
}) => {
  // Determine if variance is positive (good) or negative (bad)
  const isPositiveVariance = variance !== null && variance !== undefined && (
    varianceType === 'positive-good' ? variance >= 0 : variance <= 0
  );
  const isNegativeVariance = variance !== null && variance !== undefined && (
    varianceType === 'positive-good' ? variance < 0 : variance > 0
  );

  const cardClasses = clsx(
    'rounded-lg border p-3 text-center',
    {
      'bg-green-500 text-white border-green-600': isVarianceCard && isPositiveVariance,
      'bg-red-500 text-white border-red-600': isVarianceCard && isNegativeVariance,
      'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700': !isVarianceCard,
    }
  );

  const titleClasses = clsx(
    'text-xs font-medium',
    {
      'text-white/90': isVarianceCard && (isPositiveVariance || isNegativeVariance),
      'text-gray-500 dark:text-gray-400': !isVarianceCard,
    }
  );

  const valueClasses = clsx(
    'font-bold',
    {
      'text-2xl': size === 'lg',
      'text-xl': size === 'md',
      'text-lg': size === 'sm',
      'text-white': isVarianceCard && (isPositiveVariance || isNegativeVariance),
      'text-gray-900 dark:text-gray-100': !isVarianceCard,
    }
  );

  const displayValue = isVarianceCard && variance !== null && variance !== undefined
    ? formatVariance(variance, format)
    : formatValue(value, format);

  return (
    <div className={cardClasses}>
      <p className={titleClasses}>{title}</p>
      <p className={valueClasses}>{displayValue}</p>
    </div>
  );
};

// Row component for a complete KPI metric row (Current, Last Week, Variance, YTD, YTD Variance)
interface KPIMetricRowProps {
  metricName: string;
  currentValue: number | null;
  lastWeekValue: number | null;
  variance: number | null;
  ytdValue: number | null;
  ytdVariance: number | null;
  format?: KPIFormat;
  varianceType?: VarianceType;
}

export const KPIMetricRow: React.FC<KPIMetricRowProps> = ({
  metricName,
  currentValue,
  lastWeekValue,
  variance,
  ytdValue,
  ytdVariance,
  format = 'number',
  varianceType = 'positive-good',
}) => {
  return (
    <>
      <KPIVarianceCard
        title={metricName}
        value={currentValue}
        format={format}
      />
      <KPIVarianceCard
        title={`${metricName} LW`}
        value={lastWeekValue}
        format={format}
      />
      <KPIVarianceCard
        title={`${metricName.split(' ').map(w => w[0]).join('')} Var`}
        value={null}
        variance={variance}
        format={format}
        varianceType={varianceType}
        isVarianceCard={true}
      />
      <KPIVarianceCard
        title={`${metricName} YTD`}
        value={ytdValue}
        format={format}
      />
      <KPIVarianceCard
        title="YTD VAR"
        value={null}
        variance={ytdVariance}
        format={format}
        varianceType={varianceType}
        isVarianceCard={true}
      />
    </>
  );
};

export default KPIVarianceCard;
