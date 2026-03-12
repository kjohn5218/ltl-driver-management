/**
 * Sync Scheduler
 * Periodically syncs:
 * - Equipment data from FormsApp Fleet API
 * - Fuel surcharge rates from Fuel Price API
 * - Vehicle GPS locations from Motive API
 */

import { getFormsAppService } from './services/formsapp.service';
import { isFormsAppConfigured, getFormsAppConfig } from './config/formsapp.config';
import { getFuelPriceService } from './services/fuelPrice.service';
import { isFuelPriceConfigured, getFuelPriceConfig } from './config/fuelPrice.config';
import { getMotiveService } from './services/motive.service';
import { isMotiveConfigured, getMotiveConfig } from './config/motive.config';
import { websocketService } from './services/websocket.service';
import { geofenceService } from './services/geofence.service';
import { isGeofenceEnabled } from './config/geofence.config';

let schedulerInterval: NodeJS.Timeout | null = null;
let fuelPriceSchedulerInterval: NodeJS.Timeout | null = null;
let motiveGpsSchedulerInterval: NodeJS.Timeout | null = null;

export function startEquipmentSyncScheduler(): void {
  if (!isFormsAppConfigured()) {
    console.log('[Scheduler] FormsApp not configured, scheduler not started');
    return;
  }

  const config = getFormsAppConfig();
  const intervalMinutes = config.syncIntervalMinutes;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[Scheduler] Starting FormsApp equipment sync scheduler (every ${intervalMinutes} minutes)`);

  // Run initial sync after a short delay (30 seconds) to let server fully initialize
  setTimeout(async () => {
    console.log('[Scheduler] Running initial equipment sync...');
    await runScheduledSync();
  }, 30000);

  // Set up periodic sync
  schedulerInterval = setInterval(async () => {
    await runScheduledSync();
  }, intervalMs);
}

async function runScheduledSync(): Promise<void> {
  try {
    const service = getFormsAppService();
    const result = await service.syncAllEquipment();
    console.log(`[Scheduler] Scheduled sync complete: ${result.summary}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scheduler] Scheduled sync failed: ${message}`);
  }
}

export function stopEquipmentSyncScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Equipment sync scheduler stopped');
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

// Fuel Price Sync Scheduler
export function startFuelPriceSyncScheduler(): void {
  if (!isFuelPriceConfigured()) {
    console.log('[Scheduler] Fuel Price API not configured, fuel price scheduler not started');
    return;
  }

  const config = getFuelPriceConfig();
  const intervalMinutes = config.syncIntervalMinutes;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[Scheduler] Starting Fuel Price sync scheduler (every ${intervalMinutes} minutes)`);

  // Run initial sync after a short delay (45 seconds) to let server fully initialize
  setTimeout(async () => {
    console.log('[Scheduler] Running initial fuel price sync...');
    await runFuelPriceSync();
  }, 45000);

  // Set up periodic sync
  fuelPriceSchedulerInterval = setInterval(async () => {
    await runFuelPriceSync();
  }, intervalMs);
}

async function runFuelPriceSync(): Promise<void> {
  try {
    const service = getFuelPriceService();
    const result = await service.syncFuelSurcharge();
    if (result.success) {
      console.log(`[Scheduler] Fuel price sync complete: Rate updated to ${result.newRate}%`);
    } else {
      console.error(`[Scheduler] Fuel price sync failed: ${result.error}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scheduler] Fuel price sync failed: ${message}`);
  }
}

export function stopFuelPriceSyncScheduler(): void {
  if (fuelPriceSchedulerInterval) {
    clearInterval(fuelPriceSchedulerInterval);
    fuelPriceSchedulerInterval = null;
    console.log('[Scheduler] Fuel price sync scheduler stopped');
  }
}

export function isFuelPriceSchedulerRunning(): boolean {
  return fuelPriceSchedulerInterval !== null;
}

// Motive GPS Location Sync Scheduler
export function startMotiveGpsSyncScheduler(): void {
  if (!isMotiveConfigured()) {
    console.log('[Scheduler] Motive API not configured, GPS sync scheduler not started');
    return;
  }

  const config = getMotiveConfig();
  const intervalMinutes = config.syncIntervalMinutes;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[Scheduler] Starting Motive GPS sync scheduler (every ${intervalMinutes} minutes)`);

  // Run initial sync after a short delay (60 seconds) to let server fully initialize
  setTimeout(async () => {
    console.log('[Scheduler] Running initial Motive GPS sync...');
    await runMotiveGpsSync();
  }, 60000);

  // Set up periodic sync
  motiveGpsSchedulerInterval = setInterval(async () => {
    await runMotiveGpsSync();
  }, intervalMs);
}

async function runMotiveGpsSync(): Promise<void> {
  try {
    const service = getMotiveService();

    // Fetch latest locations from Motive API
    const locations = await service.fetchVehicleLocations();

    // Sync locations to database
    const result = await service.syncVehicleLocations();
    console.log(`[Scheduler] Motive GPS sync complete: ${result.trucksUpdated} trucks updated, ${result.trucksNotFound} not found`);

    if (result.errors.length > 0) {
      console.warn(`[Scheduler] Motive GPS sync had ${result.errors.length} errors`);
    }

    // Broadcast location updates via WebSocket
    if (locations.length > 0) {
      websocketService.broadcastLocationBatch(locations);
      console.log(`[Scheduler] Broadcast ${locations.length} vehicle locations via WebSocket`);

      // Check geofences for terminal approach/arrival alerts
      if (isGeofenceEnabled()) {
        const alerts = await geofenceService.checkVehicleLocations(locations);
        if (alerts.length > 0) {
          console.log(`[Scheduler] Generated ${alerts.length} geofence alerts`);
        }
      }
    }

    // Broadcast sync completion status
    websocketService.broadcastSyncComplete({
      trucksUpdated: result.trucksUpdated,
      trucksNotFound: result.trucksNotFound,
      total: result.total
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scheduler] Motive GPS sync failed: ${message}`);
  }
}

export function stopMotiveGpsSyncScheduler(): void {
  if (motiveGpsSchedulerInterval) {
    clearInterval(motiveGpsSchedulerInterval);
    motiveGpsSchedulerInterval = null;
    console.log('[Scheduler] Motive GPS sync scheduler stopped');
  }
}

export function isMotiveGpsSchedulerRunning(): boolean {
  return motiveGpsSchedulerInterval !== null;
}

// Start all schedulers
export function startAllSchedulers(): void {
  startEquipmentSyncScheduler();
  startFuelPriceSyncScheduler();
  startMotiveGpsSyncScheduler();
}

// Stop all schedulers
export function stopAllSchedulers(): void {
  stopEquipmentSyncScheduler();
  stopFuelPriceSyncScheduler();
  stopMotiveGpsSyncScheduler();
}
