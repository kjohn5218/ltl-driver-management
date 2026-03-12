/**
 * Geofence Service
 * Monitors vehicle locations and triggers alerts when approaching terminals
 */

import { prisma } from '../index';
import { getGeofenceConfig, isGeofenceEnabled } from '../config/geofence.config';
import { websocketService } from './websocket.service';
import { VehicleLocationData } from './motive.service';
import { log } from '../utils/logger';

export type GeofenceAlertType = 'APPROACHING' | 'ARRIVED' | 'DEPARTED';

export interface GeofenceAlert {
  type: GeofenceAlertType;
  vehicleUnitNumber: string;
  terminalId: number;
  terminalCode: string;
  terminalName: string;
  distanceMiles: number;
  timestamp: Date;
  tripId?: number;
  tripNumber?: string;
  driverName?: string;
}

interface TerminalGeofence {
  id: number;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface VehicleGeofenceState {
  lastKnownTerminalId: number | null;
  wasApproaching: boolean;
  wasArrived: boolean;
}

class GeofenceService {
  private terminalCache: Map<number, TerminalGeofence> = new Map();
  private alertCooldowns: Map<string, number> = new Map(); // key -> expiry timestamp
  private vehicleStates: Map<string, VehicleGeofenceState> = new Map();
  private lastTerminalCacheRefresh: number = 0;
  private readonly TERMINAL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Check vehicle locations against terminal geofences
   * Returns alerts for vehicles approaching or arriving at terminals
   */
  async checkVehicleLocations(locations: VehicleLocationData[]): Promise<GeofenceAlert[]> {
    if (!isGeofenceEnabled()) {
      return [];
    }

    const config = getGeofenceConfig();
    const alerts: GeofenceAlert[] = [];

    // Refresh terminal cache if needed
    await this.refreshTerminalCache();

    const terminals = Array.from(this.terminalCache.values());

    for (const location of locations) {
      const vehicleAlerts = await this.checkVehicleAgainstTerminals(
        location,
        terminals,
        config
      );
      alerts.push(...vehicleAlerts);
    }

    // Broadcast alerts via WebSocket
    for (const alert of alerts) {
      websocketService.broadcastGeofenceAlert(alert);
    }

    if (alerts.length > 0) {
      log.info('GEOFENCE', `Generated ${alerts.length} geofence alerts`);
    }

    return alerts;
  }

  /**
   * Check a single vehicle against all terminals
   */
  private async checkVehicleAgainstTerminals(
    location: VehicleLocationData,
    terminals: TerminalGeofence[],
    config: ReturnType<typeof getGeofenceConfig>
  ): Promise<GeofenceAlert[]> {
    const alerts: GeofenceAlert[] = [];
    const vehicleState = this.getVehicleState(location.unitNumber);

    // Find the closest terminal
    let closestTerminal: TerminalGeofence | null = null;
    let closestDistance = Infinity;

    for (const terminal of terminals) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        terminal.latitude,
        terminal.longitude
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestTerminal = terminal;
      }
    }

    if (!closestTerminal) {
      return alerts;
    }

    // Determine geofence status
    const isArrived = closestDistance <= config.arrivalRadiusMiles;
    const isApproaching = !isArrived && closestDistance <= config.approachRadiusMiles;

    // Get active trip for this vehicle (if any)
    const tripInfo = await this.getActiveTripForVehicle(location.unitNumber);

    // Check for ARRIVED alert
    if (isArrived && !vehicleState.wasArrived) {
      if (!this.isOnCooldown(location.unitNumber, closestTerminal.id, 'ARRIVED')) {
        alerts.push({
          type: 'ARRIVED',
          vehicleUnitNumber: location.unitNumber,
          terminalId: closestTerminal.id,
          terminalCode: closestTerminal.code,
          terminalName: closestTerminal.name,
          distanceMiles: closestDistance,
          timestamp: new Date(),
          ...tripInfo
        });
        this.setCooldown(location.unitNumber, closestTerminal.id, 'ARRIVED', config.alertCooldownMinutes);
      }
    }
    // Check for APPROACHING alert
    else if (isApproaching && !vehicleState.wasApproaching && !vehicleState.wasArrived) {
      if (!this.isOnCooldown(location.unitNumber, closestTerminal.id, 'APPROACHING')) {
        alerts.push({
          type: 'APPROACHING',
          vehicleUnitNumber: location.unitNumber,
          terminalId: closestTerminal.id,
          terminalCode: closestTerminal.code,
          terminalName: closestTerminal.name,
          distanceMiles: closestDistance,
          timestamp: new Date(),
          ...tripInfo
        });
        this.setCooldown(location.unitNumber, closestTerminal.id, 'APPROACHING', config.alertCooldownMinutes);
      }
    }
    // Check for DEPARTED alert (was arrived, now outside arrival radius)
    else if (!isArrived && vehicleState.wasArrived && vehicleState.lastKnownTerminalId === closestTerminal.id) {
      if (!this.isOnCooldown(location.unitNumber, closestTerminal.id, 'DEPARTED')) {
        alerts.push({
          type: 'DEPARTED',
          vehicleUnitNumber: location.unitNumber,
          terminalId: closestTerminal.id,
          terminalCode: closestTerminal.code,
          terminalName: closestTerminal.name,
          distanceMiles: closestDistance,
          timestamp: new Date(),
          ...tripInfo
        });
        this.setCooldown(location.unitNumber, closestTerminal.id, 'DEPARTED', config.alertCooldownMinutes);
      }
    }

    // Update vehicle state
    this.vehicleStates.set(location.unitNumber, {
      lastKnownTerminalId: isArrived ? closestTerminal.id : vehicleState.lastKnownTerminalId,
      wasApproaching: isApproaching,
      wasArrived: isArrived
    });

    return alerts;
  }

  /**
   * Get active trip information for a vehicle
   */
  private async getActiveTripForVehicle(unitNumber: string): Promise<{
    tripId?: number;
    tripNumber?: string;
    driverName?: string;
  }> {
    try {
      // Find active trip for this truck
      const trip = await prisma.linehaulTrip.findFirst({
        where: {
          truck: { unitNumber },
          status: { in: ['DISPATCHED', 'IN_TRANSIT'] }
        },
        select: {
          id: true,
          tripNumber: true,
          driverId: true
        },
        orderBy: { dispatchDate: 'desc' }
      });

      if (trip) {
        let driverName: string | undefined;

        // Fetch driver name if we have a driverId
        if (trip.driverId) {
          const driver = await prisma.carrierDriver.findUnique({
            where: { id: trip.driverId },
            select: { name: true }
          });
          if (driver) {
            driverName = driver.name;
          }
        }

        return {
          tripId: trip.id,
          tripNumber: trip.tripNumber,
          driverName
        };
      }
    } catch (error) {
      log.warn('GEOFENCE', 'Failed to get trip info for vehicle', { unitNumber, error });
    }

    return {};
  }

  /**
   * Refresh terminal cache from database
   */
  private async refreshTerminalCache(): Promise<void> {
    const now = Date.now();

    if (now - this.lastTerminalCacheRefresh < this.TERMINAL_CACHE_TTL_MS) {
      return; // Cache is still fresh
    }

    try {
      // Get terminals with coordinates
      const terminals = await prisma.terminal.findMany({
        where: {
          active: true,
          latitude: { not: null },
          longitude: { not: null }
        },
        select: {
          id: true,
          code: true,
          name: true,
          latitude: true,
          longitude: true
        }
      });

      this.terminalCache.clear();

      for (const terminal of terminals) {
        if (terminal.latitude && terminal.longitude) {
          this.terminalCache.set(terminal.id, {
            id: terminal.id,
            code: terminal.code,
            name: terminal.name,
            latitude: Number(terminal.latitude),
            longitude: Number(terminal.longitude)
          });
        }
      }

      this.lastTerminalCacheRefresh = now;
      log.debug('GEOFENCE', `Refreshed terminal cache: ${this.terminalCache.size} terminals`);
    } catch (error) {
      log.error('GEOFENCE', 'Failed to refresh terminal cache', error);
    }
  }

  /**
   * Get or initialize vehicle state
   */
  private getVehicleState(unitNumber: string): VehicleGeofenceState {
    return this.vehicleStates.get(unitNumber) || {
      lastKnownTerminalId: null,
      wasApproaching: false,
      wasArrived: false
    };
  }

  /**
   * Check if alert is on cooldown
   */
  private isOnCooldown(vehicleId: string, terminalId: number, type: GeofenceAlertType): boolean {
    const key = `${vehicleId}:${terminalId}:${type}`;
    const expiry = this.alertCooldowns.get(key);

    if (!expiry) return false;

    if (Date.now() > expiry) {
      this.alertCooldowns.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Set alert cooldown
   */
  private setCooldown(vehicleId: string, terminalId: number, type: GeofenceAlertType, minutes: number): void {
    const key = `${vehicleId}:${terminalId}:${type}`;
    this.alertCooldowns.set(key, Date.now() + minutes * 60 * 1000);
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in miles
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get geofence service statistics
   */
  getStats(): {
    enabled: boolean;
    terminalsMonitored: number;
    vehiclesTracked: number;
    activeCooldowns: number;
    config: ReturnType<typeof getGeofenceConfig>;
  } {
    return {
      enabled: isGeofenceEnabled(),
      terminalsMonitored: this.terminalCache.size,
      vehiclesTracked: this.vehicleStates.size,
      activeCooldowns: this.alertCooldowns.size,
      config: getGeofenceConfig()
    };
  }

  /**
   * Clear all cooldowns (for testing)
   */
  clearCooldowns(): void {
    this.alertCooldowns.clear();
    log.info('GEOFENCE', 'Alert cooldowns cleared');
  }

  /**
   * Force refresh terminal cache
   */
  async forceRefreshTerminals(): Promise<void> {
    this.lastTerminalCacheRefresh = 0;
    await this.refreshTerminalCache();
  }
}

// Singleton instance
export const geofenceService = new GeofenceService();
