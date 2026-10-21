import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { execute, getPool, query } from '../../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { assertValidTablePrefix, buildTableMap, codeToPrefix, ResortTables } from './prefix';

export interface CreateResortInput {
  organizationId?: string;
  regionId?: string | null;
  code: string;
  name: string;
  locationType?: 'head_office' | 'regional_office' | 'resort' | 'other';
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  attendanceConfig?: Record<string, unknown> | null;
}

export interface ProvisionedResort {
  id: string;
  code: string;
  name: string;
  tablePrefix: string;
  tables: ResortTables;
  status: 'active';
}

function createStatements(prefix: string, tables: ResortTables): string[] {
  assertValidTablePrefix(prefix);
  const p = prefix;
  return [
    `CREATE TABLE \`${tables.attendance_logs}\` (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NULL,
      device_id CHAR(36) NOT NULL,
      device_user_id VARCHAR(64) NULL,
      punch_time DATETIME(3) NOT NULL,
      punch_direction ENUM('in','out','unknown') NOT NULL DEFAULT 'unknown',
      verification_method VARCHAR(32) NULL,
      source_record_id VARCHAR(128) NULL,
      source_payload JSON NULL,
      synced_at DATETIME(3) NOT NULL,
      processing_status ENUM('pending','processed','failed','duplicate') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_source (device_id, source_record_id),
      KEY idx_emp_punch (employee_id, punch_time),
      CONSTRAINT \`fk_${p}_logs_emp\` FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT \`fk_${p}_logs_dev\` FOREIGN KEY (device_id) REFERENCES attendance_devices (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE \`${tables.daily_attendance}\` (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      attendance_date DATE NOT NULL,
      shift_id CHAR(36) NULL,
      check_in DATETIME(3) NULL,
      check_out DATETIME(3) NULL,
      working_minutes INT NULL,
      late_minutes INT NOT NULL DEFAULT 0,
      early_departure_minutes INT NOT NULL DEFAULT 0,
      status ENUM('present','absent','late','half_day','on_leave','holiday','weekly_off','missing_punch','excused') NOT NULL,
      calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_emp_date (employee_id, attendance_date),
      KEY idx_date_status (attendance_date, status),
      CONSTRAINT \`fk_${p}_daily_emp\` FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT \`fk_${p}_daily_shift\` FOREIGN KEY (shift_id) REFERENCES shifts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE \`${tables.shift_assignments}\` (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      shift_id CHAR(36) NOT NULL,
      assignment_date DATE NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_emp_assign (employee_id, assignment_date),
      CONSTRAINT \`fk_${p}_assign_emp\` FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT \`fk_${p}_assign_shift\` FOREIGN KEY (shift_id) REFERENCES shifts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE \`${tables.attendance_corrections}\` (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      attendance_date DATE NOT NULL,
      reason VARCHAR(2000) NULL,
      requested_by CHAR(36) NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      before_data JSON NULL,
      after_data JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_emp_date (employee_id, attendance_date),
      CONSTRAINT \`fk_${p}_corr_emp\` FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT \`fk_${p}_corr_user\` FOREIGN KEY (requested_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE \`${tables.leave_requests}\` (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      leave_type_id CHAR(36) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days DECIMAL(5,1) NOT NULL,
      reason VARCHAR(2000) NULL,
      status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
      reviewed_by CHAR(36) NULL,
      reviewed_at DATETIME NULL,
      review_notes VARCHAR(2000) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_emp_dates (employee_id, start_date, end_date),
      CONSTRAINT \`fk_${p}_leave_emp\` FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT \`fk_${p}_leave_type\` FOREIGN KEY (leave_type_id) REFERENCES leave_types (id),
      CONSTRAINT \`fk_${p}_leave_rev\` FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE \`${tables.overtime_records}\` (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      work_date DATE NOT NULL,
      minutes INT NOT NULL,
      reason VARCHAR(2000) NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      approved_by CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_emp_work (employee_id, work_date),
      CONSTRAINT \`fk_${p}_ot_emp\` FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT \`fk_${p}_ot_user\` FOREIGN KEY (approved_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
}

async function dropTables(tables: ResortTables): Promise<void> {
  const pool = getPool();
  const names = Object.values(tables);
  for (const name of names.reverse()) {
    assertValidTablePrefix(name.replace(/_(attendance_logs|daily_attendance|shift_assignments|attendance_corrections|leave_requests|overtime_records)$/, ''));
    await pool.query(`DROP TABLE IF EXISTS \`${name}\``);
  }
}

/**
 * Creates a location and its six attendance tables.
 * MySQL commits DDL immediately, so a failure drops any tables already created
 * and marks the resort row failed.
 */
export async function createResortWithTables(input: CreateResortInput): Promise<ProvisionedResort> {
  const code = input.code.trim().toUpperCase();
  const prefix = codeToPrefix(code);
  const tables = buildTableMap(prefix);

  const dup = await query<RowDataPacket[]>(
    `SELECT id FROM resorts WHERE code = :code OR table_prefix = :prefix LIMIT 1`,
    { code, prefix }
  );
  if (dup.length) {
    throw new ConflictError('A location with this code already exists');
  }

  const id = randomUUID();
  const created: string[] = [];

  try {
    await execute(
      `INSERT INTO resorts (
        id, organization_id, region_id, code, name, location_type, table_prefix,
        address, latitude, longitude, contact_phone, contact_email, status, attendance_config
      ) VALUES (
        :id, :organizationId, :regionId, :code, :name, :locationType, :prefix,
        :address, :latitude, :longitude, :contactPhone, :contactEmail, 'provisioning', :attendanceConfig
      )`,
      {
        id,
        organizationId: input.organizationId,
        regionId: input.regionId ?? null,
        code,
        name: input.name.trim(),
        locationType: input.locationType ?? 'resort',
        prefix,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        attendanceConfig: input.attendanceConfig ? JSON.stringify(input.attendanceConfig) : null,
      }
    );

    const pool = getPool();
    for (const sql of createStatements(prefix, tables)) {
      await pool.query(sql);
      const match = sql.match(/CREATE TABLE `([^`]+)`/);
      if (match) created.push(match[1]);
    }

    await execute(
      `INSERT INTO resort_table_registry (resort_id, table_prefix, tables_json)
       VALUES (:id, :prefix, :tables)`,
      { id, prefix, tables: JSON.stringify(tables) }
    );
    await execute(`UPDATE resorts SET status = 'active' WHERE id = :id`, { id });

    logger.info('Provisioned resort tables', { id, prefix });
    return { id, code, name: input.name.trim(), tablePrefix: prefix, tables, status: 'active' };
  } catch (error) {
    logger.error('Resort provisioning failed', { id, prefix, error });
    if (created.length) {
      await dropTables(tables).catch((dropError) => {
        logger.error('Failed to drop partial resort tables', { prefix, dropError });
      });
    }
    await execute(`DELETE FROM resort_table_registry WHERE resort_id = :id`, { id }).catch(() => undefined);
    await execute(`UPDATE resorts SET status = 'failed' WHERE id = :id`, { id }).catch(() => undefined);
    throw error;
  }
}

export async function getResortTableMap(resortId: string): Promise<ResortTables> {
  const rows = await query<RowDataPacket[]>(
    `SELECT r.table_prefix AS tablePrefix, rtr.tables_json AS tablesJson
     FROM resorts r
     INNER JOIN resort_table_registry rtr ON rtr.resort_id = r.id
     WHERE r.id = :resortId
     LIMIT 1`,
    { resortId }
  );
  if (!rows.length) throw new NotFoundError('Resort table registry not found');

  const prefix = String(rows[0].tablePrefix);
  assertValidTablePrefix(prefix);
  const parsed = typeof rows[0].tablesJson === 'string' ? JSON.parse(rows[0].tablesJson) : rows[0].tablesJson;
  const expected = buildTableMap(prefix);
  const tables = {} as ResortTables;
  for (const key of Object.keys(expected) as Array<keyof ResortTables>) {
    if (parsed?.[key] !== expected[key]) {
      throw new ValidationError('Registry table mapping does not match the prefix');
    }
    tables[key] = expected[key];
  }
  return tables;
}
