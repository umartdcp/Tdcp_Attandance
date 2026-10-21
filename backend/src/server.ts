import app from './app';
import { env } from './config/env';
import { closePool, pingDatabase } from './config/database';
import { startSyncScheduler } from './jobs/sync-scheduler';
import { logger } from './utils/logger';
import { officeLanAddress } from './utils/office-address';

const server = app.listen(env.port, () => {
  logger.info(`TDCP API listening on port ${env.port} (${env.nodeEnv})`);
  logger.info(`API prefix: ${env.apiPrefix}`);
  logger.info(`Attendance machine connects to http://${officeLanAddress()}:${env.port}/iclock/cdata`);
});

void pingDatabase().then((ok) => {
  if (!ok) {
    logger.warn('Database is not reachable. Check DB_* settings and that MySQL is running.');
  }
});

startSyncScheduler();

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down`);
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
