import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { closePool, execute, getPool, query } from '../config/database';
import { env } from '../config/env';
import { createResortWithTables, getResortTableMap } from './resort-provisioning/provisioner';
import { ingestNormalizedRecord, recalculateDailyAttendance } from '../attendance-engine';
import { listSupportedAdapters } from '../device-adapters/registry';
import { logger } from '../utils/logger';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PASSWORD = 'ChangeMe@TDCP2026';

const PERMISSIONS: Array<{ code: string; name: string }> = [
  { code: 'locations.view', name: 'View locations' },
  { code: 'locations.manage', name: 'Manage locations' },
  { code: 'employees.view', name: 'View employees' },
  { code: 'employees.manage', name: 'Manage employees' },
  { code: 'attendance.view', name: 'View attendance' },
  { code: 'attendance.correct', name: 'Correct attendance' },
  { code: 'reports.view', name: 'View reports' },
  { code: 'devices.manage', name: 'Manage devices' },
  { code: 'devices.sync', name: 'Sync devices' },
  { code: 'shifts.manage', name: 'Manage shifts' },
  { code: 'leave.apply', name: 'Apply leave' },
  { code: 'leave.approve', name: 'Approve leave' },
  { code: 'audit.view', name: 'View audit log' },
  { code: 'users.manage', name: 'Manage users' },
];

const ROLES: Array<{ code: string; name: string; permissions: string[] }> = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', permissions: PERMISSIONS.map((p) => p.code) },
  {
    code: 'HO_HR_ADMIN',
    name: 'Head Office HR Admin',
    permissions: PERMISSIONS.map((p) => p.code).filter((code) => code !== 'users.manage'),
  },
  {
    code: 'RESORT_ADMIN',
    name: 'Resort Admin',
    permissions: [
      'locations.view',
      'employees.view',
      'employees.manage',
      'attendance.view',
      'attendance.correct',
      'reports.view',
      'devices.manage',
      'devices.sync',
      'shifts.manage',
      'leave.apply',
      'leave.approve',
    ],
  },
  {
    code: 'RESORT_HR',
    name: 'Resort HR',
    permissions: [
      'employees.view',
      'employees.manage',
      'attendance.view',
      'reports.view',
      'shifts.manage',
      'leave.apply',
      'leave.approve',
    ],
  },
  {
    code: 'AUDITOR',
    name: 'Auditor',
    permissions: ['locations.view', 'employees.view', 'attendance.view', 'reports.view', 'audit.view'],
  },
  { code: 'EMPLOYEE', name: 'Employee', permissions: ['attendance.view', 'leave.apply'] },
];

const REGIONS = [
  { code: 'NORTH', name: 'North Punjab' },
  { code: 'CENTRAL', name: 'Central Punjab' },
  { code: 'SOUTH', name: 'South Punjab' },
];

const LOCATIONS: Array<{
  code: string;
  name: string;
  locationType: 'head_office' | 'resort';
  regionCode: string;
  address: string;
}> = [
  { code: 'HO_LHR', name: 'Head Office Lahore', locationType: 'head_office', regionCode: 'CENTRAL', address: 'Lahore' },
  { code: 'PATRIATA', name: 'Patriata', locationType: 'resort', regionCode: 'NORTH', address: 'Murree' },
  { code: 'CHANGA_MANGA', name: 'Changa Manga', locationType: 'resort', regionCode: 'CENTRAL', address: 'Kasur' },
  { code: 'HIRAN_MINAR', name: 'Hiran Minar', locationType: 'resort', regionCode: 'CENTRAL', address: 'Sheikhupura' },
  { code: 'DERAWAR', name: 'Derawar', locationType: 'resort', regionCode: 'SOUTH', address: 'Bahawalpur' },
  { code: 'KOT_MITHAN', name: 'Kot Mithan', locationType: 'resort', regionCode: 'SOUTH', address: 'Rajanpur' },
  { code: 'TAUNSA', name: 'Taunsa', locationType: 'resort', regionCode: 'SOUTH', address: 'Dera Ghazi Khan' },
  { code: 'DAUD_KHEL', name: 'Daud Khel', locationType: 'resort', regionCode: 'NORTH', address: 'Mianwali' },
  { code: 'DHANOI', name: 'Dhanoi', locationType: 'resort', regionCode: 'NORTH', address: 'Punjab' },
  { code: 'LAKHWAL_DAM', name: 'Lakhwal Dam', locationType: 'resort', regionCode: 'NORTH', address: 'Chakwal' },
];

function todayKarachi(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function ensureByCode(
  table: 'organizations' | 'regions' | 'roles' | 'permissions' | 'leave_types' | 'device_adapters' | 'departments' | 'shifts',
  code: string,
  insert: (id: string) => Promise<void>,
  extra?: string
): Promise<string> {
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM \`${table}\` WHERE code = :code LIMIT 1`,
    { code }
  );
  if (rows.length) return String(rows[0].id);
  const id = randomUUID();
  await insert(id);
  logger.info(`Seeded ${extra ?? table} ${code}`);
  return id;
}

async function seedReferenceData(): Promise<{
  regionIds: Record<string, string>;
  roleIds: Record<string, string>;
  permissionIds: Record<string, string>;
  shiftId: string;
  departmentId: string;
  leaveTypeIds: string[];
}> {
  const orgRows = await query<RowDataPacket[]>(`SELECT id FROM organizations WHERE id = :id`, { id: ORG_ID });
  if (!orgRows.length) {
    await execute(
      `INSERT INTO organizations (id, code, name) VALUES (:id, 'TDCP', 'Tourism Development Corporation of Punjab')`,
      { id: ORG_ID }
    );
  }

  const regionIds: Record<string, string> = {};
  for (const region of REGIONS) {
    regionIds[region.code] = await ensureByCode('regions', region.code, async (id) => {
      await execute(`INSERT INTO regions (id, code, name) VALUES (:id, :code, :name)`, {
        id,
        code: region.code,
        name: region.name,
      });
    });
  }

  const permissionIds: Record<string, string> = {};
  for (const permission of PERMISSIONS) {
    permissionIds[permission.code] = await ensureByCode('permissions', permission.code, async (id) => {
      await execute(`INSERT INTO permissions (id, code, name) VALUES (:id, :code, :name)`, {
        id,
        code: permission.code,
        name: permission.name,
      });
    });
  }

  const roleIds: Record<string, string> = {};
  for (const role of ROLES) {
    roleIds[role.code] = await ensureByCode('roles', role.code, async (id) => {
      await execute(`INSERT INTO roles (id, code, name) VALUES (:id, :code, :name)`, {
        id,
        code: role.code,
        name: role.name,
      });
    });
    for (const code of role.permissions) {
      await execute(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (:roleId, :permissionId)`,
        { roleId: roleIds[role.code], permissionId: permissionIds[code] }
      );
    }
  }

  const departmentId = await ensureByCode('departments', 'ADMIN', async (id) => {
    await execute(
      `INSERT INTO departments (id, code, name) VALUES (:id, 'ADMIN', 'Administration')`,
      { id }
    );
  });

  const shiftId = await ensureByCode('shifts', 'GENERAL', async (id) => {
    await execute(
      `INSERT INTO shifts (
        id, code, name, shift_type, start_time, end_time, is_overnight,
        grace_late_minutes, grace_early_minutes, weekly_offs, status
      ) VALUES (
        :id, 'GENERAL', 'General Day Shift', 'fixed', '09:00:00', '17:00:00', 0,
        15, 15, :weeklyOffs, 'active'
      )`,
      { id, weeklyOffs: JSON.stringify([0]) }
    );
  });

  const leaveTypeIds: string[] = [];
  const leaveTypes = [
    { code: 'ANNUAL', name: 'Annual Leave', days: 18 },
    { code: 'CASUAL', name: 'Casual Leave', days: 10 },
    { code: 'SICK', name: 'Sick Leave', days: 8 },
  ];
  for (const leaveType of leaveTypes) {
    const id = await ensureByCode('leave_types', leaveType.code, async (newId) => {
      await execute(
        `INSERT INTO leave_types (id, code, name, is_paid, requires_approval, max_days_per_year)
         VALUES (:id, :code, :name, 1, 1, :days)`,
        { id: newId, code: leaveType.code, name: leaveType.name, days: leaveType.days }
      );
    });
    leaveTypeIds.push(id);
  }

  for (const adapter of listSupportedAdapters()) {
    await ensureByCode('device_adapters', adapter.code, async (id) => {
      await execute(
        `INSERT INTO device_adapters (id, code, manufacturer, is_verified, notes)
         VALUES (:id, :code, :manufacturer, :verified, :notes)`,
        {
          id,
          code: adapter.code,
          manufacturer: adapter.manufacturer,
          verified: adapter.verified ? 1 : 0,
          notes: adapter.notes,
        }
      );
    });
  }

  return { regionIds, roleIds, permissionIds, shiftId, departmentId, leaveTypeIds };
}

async function seedLocations(regionIds: Record<string, string>): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const location of LOCATIONS) {
    const existing = await query<RowDataPacket[]>(
      `SELECT id, status FROM resorts WHERE code = :code LIMIT 1`,
      { code: location.code }
    );
    if (existing.length && existing[0].status === 'active') {
      ids[location.code] = String(existing[0].id);
      continue;
    }
    if (existing.length && existing[0].status === 'failed') {
      await execute(`DELETE FROM resorts WHERE id = :id AND status = 'failed'`, { id: existing[0].id });
    }
    const created = await createResortWithTables({
      organizationId: ORG_ID,
      regionId: regionIds[location.regionCode],
      code: location.code,
      name: location.name,
      locationType: location.locationType,
      address: location.address,
    });
    ids[location.code] = created.id;
    logger.info(`Provisioned ${location.name}`, { prefix: created.tablePrefix });
  }
  return ids;
}

async function seedEmployees(
  resortIds: Record<string, string>,
  departmentId: string,
  leaveTypeIds: string[]
): Promise<Array<{ id: string; code: string; resortCode: string; deviceUserId: string }>> {
  const samples = [
    { code: 'TDCP-1001', firstName: 'Ayesha', lastName: 'Khan', resortCode: 'HO_LHR', designation: 'HR Officer', deviceUserId: '1001' },
    { code: 'TDCP-1002', firstName: 'Bilal', lastName: 'Ahmed', resortCode: 'PATRIATA', designation: 'Resort Supervisor', deviceUserId: '1002' },
    { code: 'TDCP-1003', firstName: 'Sana', lastName: 'Iqbal', resortCode: 'CHANGA_MANGA', designation: 'Front Desk Officer', deviceUserId: '1003' },
  ];
  const today = todayKarachi();
  const year = Number(today.slice(0, 4));
  const created = [];

  for (const sample of samples) {
    const existing = await query<RowDataPacket[]>(
      `SELECT id FROM employees WHERE employee_code = :code LIMIT 1`,
      { code: sample.code }
    );
    let id = existing.length ? String(existing[0].id) : '';
    if (!id) {
      id = randomUUID();
      const resortId = resortIds[sample.resortCode];
      await execute(
        `INSERT INTO employees (
          id, employee_code, first_name, last_name, designation, department_id,
          current_resort_id, hire_date, status, email
        ) VALUES (
          :id, :code, :firstName, :lastName, :designation, :departmentId,
          :resortId, :hireDate, 'active', :email
        )`,
        {
          id,
          code: sample.code,
          firstName: sample.firstName,
          lastName: sample.lastName,
          designation: sample.designation,
          departmentId,
          resortId,
          hireDate: '2024-01-15',
          email: `${sample.firstName.toLowerCase()}.${sample.lastName.toLowerCase()}@tdcp.local`,
        }
      );
      await execute(
        `INSERT INTO employee_postings (
          id, employee_id, resort_id, department_id, designation, effective_from, is_current
        ) VALUES (:id, :employeeId, :resortId, :departmentId, :designation, '2024-01-15', 1)`,
        {
          id: randomUUID(),
          employeeId: id,
          resortId,
          departmentId,
          designation: sample.designation,
        }
      );
      for (const leaveTypeId of leaveTypeIds) {
        await execute(
          `INSERT INTO leave_balances (id, employee_id, leave_type_id, year, entitled, used, pending)
           VALUES (:id, :employeeId, :leaveTypeId, :year, 12, 0, 0)`,
          { id: randomUUID(), employeeId: id, leaveTypeId, year }
        );
      }
    }
    created.push({ id, code: sample.code, resortCode: sample.resortCode, deviceUserId: sample.deviceUserId });
  }
  return created;
}

async function seedAdmin(roleId: string): Promise<void> {
  const existing = await query<RowDataPacket[]>(
    `SELECT id FROM users WHERE username = 'superadmin' LIMIT 1`
  );
  if (existing.length) return;
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, env.bcryptRounds);
  await execute(
    `INSERT INTO users (id, username, email, password_hash, role_id, status)
     VALUES (:id, 'superadmin', 'superadmin@tdcp.local', :passwordHash, :roleId, 'active')`,
    { id: randomUUID(), passwordHash, roleId }
  );
}

async function seedDeviceAndAttendance(
  resortIds: Record<string, string>,
  employees: Array<{ id: string; code: string; resortCode: string; deviceUserId: string }>,
  shiftId: string
): Promise<void> {
  const today = todayKarachi();
  const adapters = await query<RowDataPacket[]>(
    `SELECT id FROM device_adapters WHERE code = 'generic_csv' LIMIT 1`
  );
  const hoId = resortIds.HO_LHR;
  let deviceId = '';
  const devices = await query<RowDataPacket[]>(
    `SELECT id FROM attendance_devices WHERE name = 'Head Office CSV Import' LIMIT 1`
  );
  if (devices.length) {
    deviceId = String(devices[0].id);
  } else {
    deviceId = randomUUID();
    await execute(
      `INSERT INTO attendance_devices (
        id, resort_id, adapter_id, name, serial_number, connection_method, connection_config, status
      ) VALUES (
        :id, :resortId, :adapterId, 'Head Office CSV Import', 'CSV-HO-001', 'file', :config, 'unknown'
      )`,
      { id: deviceId, resortId: hoId, adapterId: adapters[0].id, config: JSON.stringify({}) }
    );
  }

  const punches: Record<string, string[]> = {
    'TDCP-1001': ['09:05:00', '17:02:00'],
    'TDCP-1002': ['09:40:00', '17:10:00'],
  };

  for (const employee of employees) {
    const resortId = resortIds[employee.resortCode];
    if (employee.resortCode === 'HO_LHR') {
      const maps = await query<RowDataPacket[]>(
        `SELECT id FROM device_employee_mappings WHERE device_id = :deviceId AND device_user_id = :uid LIMIT 1`,
        { deviceId, uid: employee.deviceUserId }
      );
      if (!maps.length) {
        await execute(
          `INSERT INTO device_employee_mappings (id, device_id, device_user_id, employee_id, is_active)
           VALUES (:id, :deviceId, :uid, :employeeId, 1)`,
          { id: randomUUID(), deviceId, uid: employee.deviceUserId, employeeId: employee.id }
        );
      }
    }

    const tables = await getResortTableMap(resortId);
    const pool = getPool();
    const [assigned] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM \`${tables.shift_assignments}\` WHERE employee_id = ? AND assignment_date = ? LIMIT 1`,
      [employee.id, today]
    );
    if (!assigned.length) {
      await pool.execute(
        `INSERT INTO \`${tables.shift_assignments}\` (id, employee_id, shift_id, assignment_date)
         VALUES (?, ?, ?, ?)`,
        [randomUUID(), employee.id, shiftId, today]
      );
    }

    for (const time of punches[employee.code] ?? []) {
      const punchTime = new Date(`${today}T${time}+05:00`);
      await ingestNormalizedRecord({
        employeeId: employee.id,
        deviceUserId: employee.deviceUserId,
        deviceId,
        resortId,
        punchTime,
        punchDirection: time < '12:00:00' ? 'in' : 'out',
        verificationMethod: 'csv',
        sourceRecordId: `${employee.code}|${today}|${time}`,
        syncedAt: new Date(),
        sourcePayload: { employeeCode: employee.code, punchTime: `${today}T${time}+05:00` },
        processingStatus: 'pending',
      });
    }

    await recalculateDailyAttendance(resortId, employee.id, today, { shiftId });
  }
}

async function main(): Promise<void> {
  const { regionIds, roleIds, shiftId, departmentId, leaveTypeIds } = await seedReferenceData();
  const resortIds = await seedLocations(regionIds);
  const employees = await seedEmployees(resortIds, departmentId, leaveTypeIds);
  await seedAdmin(roleIds.SUPER_ADMIN);
  await seedDeviceAndAttendance(resortIds, employees, shiftId);
  logger.info('Seed complete');
  logger.info('Super admin username: superadmin');
  logger.info('Super admin password: ChangeMe@TDCP2026 — change this after first login');
}

main()
  .catch((error) => {
    logger.error('Seed failed', { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
