import { RowDataPacket } from 'mysql2/promise';
import { closePool, execute, getPool } from '../config/database';
import { env } from '../config/env';
import * as core from './migrations/001_core';
import { logger } from '../utils/logger';

const MIGRATIONS = [core];

async function ensureMigrationsTable(): Promise<void> {
  await getPool().query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(128) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function appliedNames(): Promise<string[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT name FROM schema_migrations ORDER BY applied_at ASC, name ASC`
  );
  return rows.map((row) => String(row.name));
}

async function main(): Promise<void> {
  const rollback = process.argv.includes('--rollback');
  if (rollback && env.isProd) {
    logger.error('migrate:rollback is disabled when NODE_ENV=production');
    process.exitCode = 1;
    return;
  }

  await ensureMigrationsTable();

  if (rollback) {
    const applied = await appliedNames();
    const lastName = applied[applied.length - 1];
    const migration = [...MIGRATIONS].reverse().find((item) => item.name === lastName);
    if (!migration) {
      logger.info('Nothing to roll back');
      return;
    }
    await migration.down(getPool());
    await execute(`DELETE FROM schema_migrations WHERE name = :name`, { name: migration.name });
    logger.info(`Rolled back ${migration.name}`);
    return;
  }

  const applied = new Set(await appliedNames());
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) {
      logger.info(`Already applied ${migration.name}`);
      continue;
    }
    await migration.up(getPool());
    await execute(`INSERT INTO schema_migrations (name) VALUES (:name)`, { name: migration.name });
    logger.info(`Applied ${migration.name}`);
  }
}

main()
  .catch((error) => {
    logger.error('Migration failed', { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
