/**
 * Geofence Configuration
 * Settings for terminal approach alerts and geofence monitoring
 */

export interface GeofenceConfig {
  // Radius in miles for "approaching" alert
  approachRadiusMiles: number;
  // Radius in miles for "arrived" alert
  arrivalRadiusMiles: number;
  // Minimum time between alerts for same vehicle/terminal (minutes)
  alertCooldownMinutes: number;
  // Whether geofence monitoring is enabled
  enabled: boolean;
}

export const getGeofenceConfig = (): GeofenceConfig => {
  const approachRadius = parseFloat(process.env.GEOFENCE_APPROACH_RADIUS_MILES || '10');
  const arrivalRadius = parseFloat(process.env.GEOFENCE_ARRIVAL_RADIUS_MILES || '1');
  const cooldown = parseInt(process.env.GEOFENCE_ALERT_COOLDOWN_MINUTES || '15', 10);
  const enabled = process.env.GEOFENCE_ENABLED !== 'false'; // Enabled by default

  return {
    approachRadiusMiles: isNaN(approachRadius) || approachRadius < 0.1 ? 10 : approachRadius,
    arrivalRadiusMiles: isNaN(arrivalRadius) || arrivalRadius < 0.1 ? 1 : arrivalRadius,
    alertCooldownMinutes: isNaN(cooldown) || cooldown < 1 ? 15 : cooldown,
    enabled
  };
};

export const isGeofenceEnabled = (): boolean => {
  return getGeofenceConfig().enabled;
};
