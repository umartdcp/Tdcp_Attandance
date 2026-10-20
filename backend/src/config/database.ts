import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from './env';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      connectionLimit: env.db.connectionLimit,
      namedPlaceholders: true,
      timezone: '+05:00',
      dateStrings: false,
      multipleStatements: false,
    });
    logger.info('MySQL connection pool created', {
      host: env.db.host,
      database: env.db.database,
    });
  }
  return pool;
}

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: Record<string, unknown> | unknown[]
): Promise<T> {
  const [rows] = await getPool().execute<T>(sql, params as never);
  return rows;
}

export async function execute(
  sql: string,
  params?: Record<string, unknown> | unknown[]
): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params as never);
  return result;
}

export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await query<RowDataPacket[]>('SELECT 1 AS ok');
    return true;
  } catch (error) {
    logger.error('Database ping failed', { error });
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
