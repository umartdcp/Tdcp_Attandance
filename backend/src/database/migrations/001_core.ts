import { Pool, RowDataPacket } from 'mysql2/promise';
import { logger } from '../../utils/logger';

export const name = '001_core';

const CORE_TABLES = [
  'device_sync_logs',
  'device_employee_mappings',
  'attendance_devices',
  'device_adapters',
  'audit_logs',
  'leave_balances',
  'leave_types',
  'shifts',
  'employee_transfers',
  'user_location_access',
  'users',
  'employee_postings',
  'employees',
  'departments',
  'resort_table_registry',
  'resorts',
  'regions',
  'role_permissions',
  'permissions',
  'roles',
  'organizations',
];

async function runAll(pool: Pool, statements: string[]): Promise<void> {
  for (const sql of statements) {
    await pool.query(sql);
  }
}

export async function up(pool: Pool): Promise<void> {
  await runAll(pool, [
    `CREATE TABLE IF NOT EXISTS organizations (
      id CHAR(36) NOT NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(255) NOT NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_org_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS regions (
      id CHAR(36) NOT NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(128) NOT NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_region_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS roles (
      id CHAR(36) NOT NULL,
      code VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_role_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS permissions (
      id CHAR(36) NOT NULL,
      code VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_permission_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id CHAR(36) NOT NULL,
      permission_id CHAR(36) NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id),
      CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS resorts (
      id CHAR(36) NOT NULL,
      organization_id CHAR(36) NOT NULL,
      region_id CHAR(36) NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(255) NOT NULL,
      location_type ENUM('head_office','regional_office','resort','other') NOT NULL DEFAULT 'resort',
      table_prefix VARCHAR(48) NOT NULL,
      address VARCHAR(1000) NULL,
      contact_phone VARCHAR(32) NULL,
      contact_email VARCHAR(255) NULL,
      status ENUM('active','inactive','provisioning','failed') NOT NULL DEFAULT 'provisioning',
      attendance_config JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_resort_code (code),
      UNIQUE KEY uq_resort_prefix (table_prefix),
      CONSTRAINT fk_resorts_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
      CONSTRAINT fk_resorts_region FOREIGN KEY (region_id) REFERENCES regions (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS resort_table_registry (
      resort_id CHAR(36) NOT NULL,
      table_prefix VARCHAR(48) NOT NULL,
      tables_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (resort_id),
      CONSTRAINT fk_registry_resort FOREIGN KEY (resort_id) REFERENCES resorts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS departments (
      id CHAR(36) NOT NULL,
      resort_id CHAR(36) NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(128) NOT NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_dept_code (code),
      CONSTRAINT fk_dept_resort FOREIGN KEY (resort_id) REFERENCES resorts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS employees (
      id CHAR(36) NOT NULL,
      employee_code VARCHAR(32) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      father_name VARCHAR(150) NULL,
      cnic VARCHAR(20) NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(32) NULL,
      designation VARCHAR(128) NULL,
      department_id CHAR(36) NULL,
      current_resort_id CHAR(36) NULL,
      hire_date DATE NULL,
      status ENUM('active','inactive','transferred') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_employee_code (employee_code),
      KEY idx_resort_status (current_resort_id, status),
      CONSTRAINT fk_emp_dept FOREIGN KEY (department_id) REFERENCES departments (id),
      CONSTRAINT fk_emp_resort FOREIGN KEY (current_resort_id) REFERENCES resorts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS employee_postings (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      resort_id CHAR(36) NOT NULL,
      department_id CHAR(36) NULL,
      designation VARCHAR(128) NULL,
      effective_from DATE NOT NULL,
      effective_to DATE NULL,
      is_current TINYINT(1) NOT NULL DEFAULT 1,
      notes VARCHAR(2000) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_posting_current (employee_id, is_current),
      CONSTRAINT fk_posting_emp FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT fk_posting_resort FOREIGN KEY (resort_id) REFERENCES resorts (id),
      CONSTRAINT fk_posting_dept FOREIGN KEY (department_id) REFERENCES departments (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) NOT NULL,
      username VARCHAR(64) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role_id CHAR(36) NOT NULL,
      employee_id CHAR(36) NULL,
      status ENUM('active','inactive','locked') NOT NULL DEFAULT 'active',
      last_login_at DATETIME NULL,
      refresh_token_hash VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username),
      UNIQUE KEY uq_users_email (email),
      CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id),
      CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS user_location_access (
      user_id CHAR(36) NOT NULL,
      resort_id CHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, resort_id),
      CONSTRAINT fk_ula_user FOREIGN KEY (user_id) REFERENCES users (id),
      CONSTRAINT fk_ula_resort FOREIGN KEY (resort_id) REFERENCES resorts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS employee_transfers (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      from_resort_id CHAR(36) NULL,
      to_resort_id CHAR(36) NOT NULL,
      from_department_id CHAR(36) NULL,
      to_department_id CHAR(36) NULL,
      transfer_date DATE NOT NULL,
      reason VARCHAR(2000) NULL,
      approved_by CHAR(36) NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_transfer_emp (employee_id, transfer_date),
      CONSTRAINT fk_transfer_emp FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT fk_transfer_from FOREIGN KEY (from_resort_id) REFERENCES resorts (id),
      CONSTRAINT fk_transfer_to FOREIGN KEY (to_resort_id) REFERENCES resorts (id),
      CONSTRAINT fk_transfer_user FOREIGN KEY (approved_by) REFERENCES users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS shifts (
      id CHAR(36) NOT NULL,
      resort_id CHAR(36) NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(128) NOT NULL,
      shift_type VARCHAR(32) NOT NULL DEFAULT 'fixed',
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_overnight TINYINT(1) NOT NULL DEFAULT 0,
      grace_late_minutes INT NOT NULL DEFAULT 15,
      grace_early_minutes INT NOT NULL DEFAULT 15,
      weekly_offs JSON NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_shift_code (code),
      CONSTRAINT fk_shift_resort FOREIGN KEY (resort_id) REFERENCES resorts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS leave_types (
      id CHAR(36) NOT NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(128) NOT NULL,
      is_paid TINYINT(1) NOT NULL DEFAULT 1,
      requires_approval TINYINT(1) NOT NULL DEFAULT 1,
      max_days_per_year DECIMAL(5,1) NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      PRIMARY KEY (id),
      UNIQUE KEY uq_leave_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS leave_balances (
      id CHAR(36) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      leave_type_id CHAR(36) NOT NULL,
      year INT NOT NULL,
      entitled DECIMAL(6,1) NOT NULL DEFAULT 0,
      used DECIMAL(6,1) NOT NULL DEFAULT 0,
      pending DECIMAL(6,1) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_balance (employee_id, leave_type_id, year),
      CONSTRAINT fk_balance_emp FOREIGN KEY (employee_id) REFERENCES employees (id),
      CONSTRAINT fk_balance_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS device_adapters (
      id CHAR(36) NOT NULL,
      code VARCHAR(64) NOT NULL,
      manufacturer VARCHAR(128) NOT NULL,
      is_verified TINYINT(1) NOT NULL DEFAULT 0,
      notes VARCHAR(500) NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      PRIMARY KEY (id),
      UNIQUE KEY uq_adapter_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS attendance_devices (
      id CHAR(36) NOT NULL,
      resort_id CHAR(36) NOT NULL,
      adapter_id CHAR(36) NOT NULL,
      name VARCHAR(128) NOT NULL,
      serial_number VARCHAR(128) NULL,
      connection_method VARCHAR(32) NOT NULL,
      connection_config JSON NULL,
      status ENUM('online','offline','error','unknown') NOT NULL DEFAULT 'unknown',
      last_sync_at DATETIME NULL,
      last_attendance_at DATETIME NULL,
      total_imported_records INT NOT NULL DEFAULT 0,
      last_error VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_device_resort (resort_id, status),
      CONSTRAINT fk_device_resort FOREIGN KEY (resort_id) REFERENCES resorts (id),
      CONSTRAINT fk_device_adapter FOREIGN KEY (adapter_id) REFERENCES device_adapters (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS device_employee_mappings (
      id CHAR(36) NOT NULL,
      device_id CHAR(36) NOT NULL,
      device_user_id VARCHAR(64) NOT NULL,
      employee_id CHAR(36) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_device_user (device_id, device_user_id),
      CONSTRAINT fk_map_device FOREIGN KEY (device_id) REFERENCES attendance_devices (id),
      CONSTRAINT fk_map_emp FOREIGN KEY (employee_id) REFERENCES employees (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS device_sync_logs (
      id CHAR(36) NOT NULL,
      device_id CHAR(36) NOT NULL,
      sync_type VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL,
      records_fetched INT NOT NULL DEFAULT 0,
      records_imported INT NOT NULL DEFAULT 0,
      duplicates_skipped INT NOT NULL DEFAULT 0,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_sync_device (device_id, started_at),
      CONSTRAINT fk_sync_device FOREIGN KEY (device_id) REFERENCES attendance_devices (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id CHAR(36) NOT NULL,
      actor_user_id CHAR(36) NULL,
      action VARCHAR(128) NOT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id CHAR(36) NULL,
      resort_id CHAR(36) NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      before_data JSON NULL,
      after_data JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_audit_created (created_at),
      KEY idx_audit_entity (entity_type, entity_id),
      CONSTRAINT fk_audit_user FOREIGN KEY (actor_user_id) REFERENCES users (id),
      CONSTRAINT fk_audit_resort FOREIGN KEY (resort_id) REFERENCES resorts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `INSERT IGNORE INTO organizations (id, code, name)
     VALUES ('11111111-1111-1111-1111-111111111111', 'TDCP', 'Tourism Development Corporation of Punjab')`,
  ]);
  logger.info('Core schema is present');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name AS tableName
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name LIKE 'tdcp\\_%'`
  );
  for (const row of rows) {
    const tableName = String(row.tableName);
    if (!/^tdcp_[a-z0-9_]+$/.test(tableName)) continue;
    await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
  }
  for (const table of CORE_TABLES) {
    await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}
