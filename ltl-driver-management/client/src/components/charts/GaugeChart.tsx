import React from 'react';

interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  thresholds?: {
    warning: number; // Below this is red
    good: number;    // Above this is green, between warning and good is yellow
  };
  size?: 'sm' | 'md' | 'lg';
  invertColors?: boolean; // If true, lower values are green (like CPM)
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  min = 0,
  max = 100,
  label,
  unit = '%',
  thresholds = { warning: 33, good: 66 },
  size = 'md',
  invertColors = false,
}) => {
  // Size configurations
  const sizes = {
    sm: { width: 120, height: 80, strokeWidth: 12, fontSize: 16, labelSize: 10 },
    md: { width: 180, height: 110, strokeWidth: 16, fontSize: 24, labelSize: 12 },
    lg: { width: 240, height: 140, strokeWidth: 20, fontSize: 32, labelSize: 14 },
  };

  const config = sizes[size];
  const centerX = config.width / 2;
  const centerY = config.height - 10;
  const radius = config.width / 2 - config.strokeWidth;

  // Clamp value to min/max range
  const clampedValue = Math.min(Math.max(value, min), max);
  const percentage = ((clampedValue - min) / (max - min)) * 100;

  // Convert percentage to angle (180 degrees = full arc)
  const angle = (percentage / 100) * 180;

  // Create arc path for background
  const createArc = (startAngle: number, endAngle: number) => {
    const startRad = ((180 - startAngle) * Math.PI) / 180;
    const endRad = ((180 - endAngle) * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY - radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY - radius * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${x2} ${y2}`;
  };

  // Get color based on value and thresholds
  const getColor = (val: number) => {
    const pct = ((val - min) / (max - min)) * 100;
    if (invertColors) {
      // Lower is better (e.g., CPM)
      if (pct <= thresholds.warning) return '#22c55e'; // green
      if (pct <= thresholds.good) return '#eab308'; // yellow
      return '#ef4444'; // red
    } else {
      // Higher is better (e.g., load factor, on-time %)
      if (pct >= thresholds.good) return '#22c55e'; // green
      if (pct >= thresholds.warning) return '#eab308'; // yellow
      return '#ef4444'; // red
    }
  };

  // Create needle path
  const needleAngle = ((180 - angle) * Math.PI) / 180;
  const needleLength = radius - 10;
  const needleX = centerX + needleLength * Math.cos(needleAngle);
  const needleY = centerY - needleLength * Math.sin(needleAngle);

  // Background arc segments (for color zones)
  const warningPct = thresholds.warning;
  const goodPct = thresholds.good;

  // Calculate angles for color zone boundaries
  const warningAngle = (warningPct / 100) * 180;
  const goodAngle = (goodPct / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <svg width={config.width} height={config.height} viewBox={`0 0 ${config.width} ${config.height}`}>
        {/* Background color zones */}
        {invertColors ? (
          <>
            {/* Green zone (0 to warning) */}
            <path
              d={createArc(0, warningAngle)}
              fill="none"
              stroke="#dcfce7"
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
            />
            {/* Yellow zone (warning to good) */}
            <path
              d={createArc(warningAngle, goodAngle)}
              fill="none"
              stroke="#fef9c3"
              strokeWidth={config.strokeWidth}
            />
            {/* Red zone (good to 180) */}
            <path
              d={createArc(goodAngle, 180)}
              fill="none"
              stroke="#fecaca"
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            {/* Red zone (0 to warning) */}
            <path
              d={createArc(0, warningAngle)}
              fill="none"
              stroke="#fecaca"
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
            />
            {/* Yellow zone (warning to good) */}
            <path
              d={createArc(warningAngle, goodAngle)}
              fill="none"
              stroke="#fef9c3"
              strokeWidth={config.strokeWidth}
            />
            {/* Green zone (good to 180) */}
            <path
              d={createArc(goodAngle, 180)}
              fill="none"
              stroke="#dcfce7"
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
            />
          </>
        )}

        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke={getColor(clampedValue)}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Center circle */}
        <circle cx={centerX} cy={centerY} r={6} fill={getColor(clampedValue)} />

        {/* Value text */}
        <text
          x={centerX}
          y={centerY - 20}
          textAnchor="middle"
          className="fill-gray-900 dark:fill-gray-100"
          style={{ fontSize: config.fontSize, fontWeight: 'bold' }}
        >
          {value.toFixed(unit === '%' ? 1 : 2)}{unit}
        </text>

        {/* Min/Max labels */}
        <text
          x={config.strokeWidth}
          y={centerY + 2}
          textAnchor="start"
          className="fill-gray-500 dark:fill-gray-400"
          style={{ fontSize: config.labelSize - 2 }}
        >
          {min}
        </text>
        <text
          x={config.width - config.strokeWidth}
          y={centerY + 2}
          textAnchor="end"
          className="fill-gray-500 dark:fill-gray-400"
          style={{ fontSize: config.labelSize - 2 }}
        >
          {max}
        </text>
      </svg>

      {label && (
        <span
          className="text-gray-600 dark:text-gray-400 mt-1"
          style={{ fontSize: config.labelSize }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export default GaugeChart;
