import { randomUUID } from 'crypto';
import ZKLib from 'node-zklib';
import { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../config/database';
import { ingestNormalizedRecord, recalculateDailyAttendance, toBusinessDate } from '../attendance-engine';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const running = new Set<string>();

function karachiToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

function splitName(value: string): { firstName: string; lastName: string } {
  const clean = value.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return { firstName: 'Employee', lastName: '-' };
  const parts = clean.split(' ');
  if (parts.length === 1) return { firstName: parts[0].slice(0, 100), lastName: '-' };
  return {
    firstName: parts[0].slice(0, 100),
    lastName: parts.slice(1).join(' ').slice(0, 100) || '-',
  };
}

function punchInstant(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  return parsed;
}

export async function syncZktecoDevice(deviceId: string): Promise<{
  employees: number;
  created: number;
  punches: number;
  today: string;
}> {
  if (running.has(deviceId)) {
    throw new ValidationError('This machine is already syncing. Wait for it to finish.');
  }
  running.add(deviceId);
  try {
    const devices = await query<RowDataPacket[]>(
      `SELECT d.id, d.resort_id AS resortId, d.connection_config AS connectionConfig, a.code AS adapterCode
       FROM attendance_devices d
       INNER JOIN device_adapters a ON a.id = d.adapter_id
       WHERE d.id = :id LIMIT 1`,
      { id: deviceId }
    );
    if (!devices.length) throw new ValidationError('Machine not found');
    if (devices[0].adapterCode !== 'zkteco_pull') {
      throw new ValidationError('Only a ZKTeco machine can download employees and attendance');
    }
    const config =
      typeof devices[0].connectionConfig === 'string'
        ? (JSON.parse(devices[0].connectionConfig) as Record<string, unknown>)
        : ((devices[0].connectionConfig ?? {}) as Record<string, unknown>);
    const host = typeof config.host === 'string' ? config.host : '';
    const port = Number(config.port ?? 4370);
    if (!host) throw new ValidationError('This machine has no IP address');

    const resortId = String(devices[0].resortId);
    const zk = new ZKLib(host, port, 20000, 4000);
    let users: Array<{ uid: number; name: string; userId: string }> = [];
    let logs: Array<{ userSn: number; deviceUserId: string; recordTime: Date | string }> = [];
    try {
      await zk.createSocket();
      users = (await zk.getUsers()).data ?? [];
      logs = (await zk.getAttendances()).data ?? [];
    } finally {
      try {
        await zk.disconnect();
      } catch {
        /* the session is already closed */
      }
    }

    let created = 0;
    for (const user of users) {
      const deviceUserId = String(user.userId ?? '').trim() || String(user.uid);
      const inserted = await upsertMachineEmployee(resortId, deviceId, deviceUserId, user.name ?? '');
      if (inserted) created++;
    }

    const today = karachiToday();
    const employeeIds = new Map<string, string>();
    const enrolled = await query<RowDataPacket[]>(
      `SELECT id, device_user_id AS deviceUserId, employee_code AS employeeCode
       FROM employees WHERE current_resort_id = :resortId`,
      { resortId }
    );
    for (const row of enrolled) {
      if (row.deviceUserId) employeeIds.set(String(row.deviceUserId), String(row.id));
      employeeIds.set(String(row.employeeCode), String(row.id));
    }

    let punches = 0;
    const touched = new Set<string>();
    for (const log of logs) {
      const instant = punchInstant(log.recordTime);
      if (Number.isNaN(instant.getTime())) continue;
      if (toBusinessDate(instant) !== today) continue;
      const deviceUserId = String(log.deviceUserId ?? '').trim();
      if (!deviceUserId) continue;
      const employeeId = employeeIds.get(deviceUserId) ?? null;
      const result = await ingestNormalizedRecord({
        employeeId,
        deviceUserId,
        deviceId,
        resortId,
        punchTime: instant,
        punchDirection: 'unknown',
        verificationMethod: 'fingerprint',
        sourceRecordId: `${deviceId}|${log.userSn}`,
        syncedAt: new Date(),
        sourcePayload: { userSn: log.userSn, deviceUserId },
        processingStatus: 'pending',
      });
      if (result.inserted) punches++;
      if (employeeId) touched.add(employeeId);
    }

    const everyone = await query<RowDataPacket[]>(
      `SELECT id FROM employees WHERE current_resort_id = :resortId AND status = 'active'`,
      { resortId }
    );
    for (const row of everyone) {
      await recalculateDailyAttendance(resortId, String(row.id), today);
    }

    await execute(
      `UPDATE attendance_devices
       SET status = 'online', last_error = NULL, last_sync_at = NOW(),
           last_attendance_at = NOW(),
           total_imported_records = total_imported_records + :punches
       WHERE id = :id`,
      { id: deviceId, punches }
    );

    logger.info('ZKTeco sync finished', { deviceId, employees: users.length, created, punches, today });
    return { employees: users.length, created, punches, today };
  } finally {
    running.delete(deviceId);
  }
}

async function upsertMachineEmployee(
  resortId: string,
  deviceId: string,
  deviceUserId: string,
  rawName: string
): Promise<boolean> {
  const code = deviceUserId.slice(0, 32);
  const { firstName, lastName } = splitName(rawName);
  const existing = await query<RowDataPacket[]>(
    `SELECT id FROM employees
     WHERE device_user_id = :uid OR employee_code = :code
     LIMIT 1`,
    { uid: deviceUserId, code }
  );

  let employeeId: string;
  let created = false;
  if (existing.length) {
    employeeId = String(existing[0].id);
    await execute(
      `UPDATE employees
       SET first_name = :firstName, last_name = :lastName, device_user_id = :uid,
           current_resort_id = :resortId, status = 'active',
           finger_status = 'captured'
       WHERE id = :id`,
      { id: employeeId, firstName, lastName, uid: deviceUserId, resortId }
    );
  } else {
    employeeId = randomUUID();
    created = true;
    await execute(
      `INSERT INTO employees (
        id, employee_code, first_name, last_name, device_user_id, finger_status,
        shift_start, shift_end, current_resort_id, status
      ) VALUES (:id, :code, :firstName, :lastName, :uid, 'captured', '09:00:00', '17:00:00', :resortId, 'active')`,
      { id: employeeId, code, firstName, lastName, uid: deviceUserId, resortId }
    );
    await execute(
      `INSERT INTO employee_postings (id, employee_id, resort_id, effective_from, is_current)
       VALUES (:id, :employeeId, :resortId, CURDATE(), 1)`,
      { id: randomUUID(), employeeId, resortId }
    );
  }

    await execute(
      `INSERT INTO device_employee_mappings (id, device_id, device_user_id, employee_id, is_active)
       VALUES (:id, :deviceId, :uid, :employeeId, 1) AS new_row
       ON DUPLICATE KEY UPDATE employee_id = new_row.employee_id, is_active = 1`,
      { id: randomUUID(), deviceId, uid: deviceUserId, employeeId }
    );
  return created;
}
