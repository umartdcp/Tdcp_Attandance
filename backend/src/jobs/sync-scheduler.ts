import cron from 'node-cron';
import { logger } from '../utils/logger';

/**
 * Scheduled device sync placeholder.
 * Live pulls should only run for adapters whose fetchAttendanceLogs capability is verified.
 */
export function startSyncScheduler(): void {
  cron.schedule('*/15 * * * *', () => {
    logger.debug('Sync scheduler tick — no verified live device adapters queued');
  });
  logger.info('Device sync scheduler registered (every 15 minutes)');
}
