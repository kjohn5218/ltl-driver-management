/**
 * Equipment Sync Scheduler
 * Periodically syncs equipment data from FormsApp Fleet API
 */

import { getFormsAppService } from './services/formsapp.service';
import { isFormsAppConfigured, getFormsAppConfig } from './config/formsapp.config';

let schedulerInterval: NodeJS.Timeout | null = null;

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
