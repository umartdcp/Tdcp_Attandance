import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { getPool, query } from '../config/database';
import { getResortTableMap } from '../database/resort-provisioning/provisioner';
import { assertValidTablePrefix } from '../database/resort-provisioning/prefix';
import { calculateDailyAttendance, toBusinessDate } from './calculator';
import { NormalizedAttendanceRecord, ShiftWindow } from './types';
import { logger } from '../utils/logger';

async function loadShift(shiftId: string | null): Promise<ShiftWindow | null> {
  if (!shiftId) return null;
  const rows = await query<RowDataPacket[]>(
    `SELECT id, start_time AS startTime, end_time AS endTime, is_overnight AS isOvernight,
            grace_late_minutes AS graceLateMinutes, grace_early_minutes AS graceEarlyMinutes,
            weekly_offs AS weeklyOffs
     FROM shifts WHERE id = :id LIMIT 1`,
    { id: shiftId }
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    startTime: String(r.startTime).slice(0, 8),
    endTime: String(r.endTime).slice(0, 8),
    isOvernight: Boolean(r.isOvernight),
    graceLateMinutes: Number(r.graceLateMinutes),
    graceEarlyMinutes: Number(r.graceEarlyMinutes),
    weeklyOffs: (typeof r.weeklyOffs === 'string' ? JSON.parse(r.weeklyOffs) : r.weeklyOffs) ?? [],
  };
}

/**
 * Persist a normalized punch into the resort-specific attendance_logs table (idempotent).
 */
export async function ingestNormalizedRecord(
  record: NormalizedAttendanceRecord
): Promise<{ inserted: boolean; id: string }> {
  const tables = await getResortTableMap(record.resortId);
  const logsTable = tables.attendance_logs;
  assertValidTablePrefix(logsTable.replace(/_attendance_logs$/, ''));

  const id = randomUUID();
  const pool = getPool();
  try {
    await pool.execute(
      `INSERT INTO \`${logsTable}\` (
        id, employee_id, device_id, device_user_id, punch_time, punch_direction,
        verification_method, source_record_id, source_payload, synced_at, processing_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        record.employeeId ?? null,
        record.deviceId,
        record.deviceUserId ?? null,
        record.punchTime,
        record.punchDirection,
        record.verificationMethod ?? null,
        record.sourceRecordId ?? null,
        JSON.stringify(record.sourcePayload ?? {}),
        record.syncedAt,
      ]
    );
    return { inserted: true, id };
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'ER_DUP_ENTRY') {
      return { inserted: false, id };
    }
    throw error;
  }
}

/**
 * Recalculate daily attendance for an employee on a business date at a resort.
 */
export async function recalculateDailyAttendance(
  resortId: string,
  employeeId: string,
  attendanceDate: string,
  options?: { shiftId?: string | null; isOnLeave?: boolean; isHoliday?: boolean }
): Promise<void> {
  const tables = await getResortTableMap(resortId);
  const logsTable = tables.attendance_logs;
  const dailyTable = tables.daily_attendance;

  const pool = getPool();
  const [punchRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, employee_id AS employeeId, device_id AS deviceId, punch_time AS punchTime,
            punch_direction AS punchDirection, device_user_id AS deviceUserId,
            verification_method AS verificationMethod, source_record_id AS sourceRecordId,
            source_payload AS sourcePayload, synced_at AS syncedAt, processing_status AS processingStatus
     FROM \`${logsTable}\`
     WHERE employee_id = ? AND DATE(punch_time) = ?
       AND processing_status IN ('pending', 'processed')
     ORDER BY punch_time ASC`,
    [employeeId, attendanceDate]
  );

  const punches: NormalizedAttendanceRecord[] = punchRows.map((p) => ({
    employeeId: p.employeeId,
    deviceUserId: p.deviceUserId,
    deviceId: p.deviceId,
    resortId,
    punchTime: new Date(p.punchTime),
    punchDirection: p.punchDirection,
    verificationMethod: p.verificationMethod,
    sourceRecordId: p.sourceRecordId,
    syncedAt: new Date(p.syncedAt),
    sourcePayload: p.sourcePayload,
    processingStatus: p.processingStatus,
  }));

  let shiftId = options?.shiftId ?? null;
  if (!shiftId) {
    const [assign] = await pool.execute<RowDataPacket[]>(
      `SELECT shift_id AS shiftId FROM \`${tables.shift_assignments}\`
       WHERE employee_id = ? AND assignment_date = ? LIMIT 1`,
      [employeeId, attendanceDate]
    );
    shiftId = assign[0]?.shiftId ?? null;
  }

  let shift = await loadShift(shiftId);
  let synthesizedShift = false;
  if (!shift) {
    const hours = await query<RowDataPacket[]>(
      `SELECT shift_start AS shiftStart, shift_end AS shiftEnd FROM employees WHERE id = :id LIMIT 1`,
      { id: employeeId }
    );
    const start = hours[0]?.shiftStart;
    const end = hours[0]?.shiftEnd;
    if (start && end) {
      synthesizedShift = true;
      shift = {
        id: 'employee-hours',
        startTime: String(start).slice(0, 8),
        endTime: String(end).slice(0, 8),
        isOvernight: String(end) <= String(start),
        graceLateMinutes: 15,
        graceEarlyMinutes: 15,
        weeklyOffs: [0],
      };
    }
  }
  const result = calculateDailyAttendance({
    employeeId,
    attendanceDate,
    punches,
    shift,
    isOnLeave: options?.isOnLeave,
    isHoliday: options?.isHoliday,
  });
  if (synthesizedShift) result.shiftId = null;

  const dailyId = randomUUID();
  await pool.execute(
    `INSERT INTO \`${dailyTable}\` (
      id, employee_id, attendance_date, shift_id, check_in, check_out, working_minutes,
      late_minutes, early_departure_minutes, status, calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      shift_id = VALUES(shift_id),
      check_in = VALUES(check_in),
      check_out = VALUES(check_out),
      working_minutes = VALUES(working_minutes),
      late_minutes = VALUES(late_minutes),
      early_departure_minutes = VALUES(early_departure_minutes),
      status = VALUES(status),
      calculated_at = NOW()`,
    [
      dailyId,
      result.employeeId,
      result.attendanceDate,
      result.shiftId,
      result.checkIn,
      result.checkOut,
      result.workingMinutes,
      result.lateMinutes,
      result.earlyDepartureMinutes,
      result.status,
    ]
  );

  if (punches.length) {
    await pool.execute(
      `UPDATE \`${logsTable}\` SET processing_status = 'processed'
       WHERE employee_id = ? AND DATE(punch_time) = ?`,
      [employeeId, attendanceDate]
    );
  }

  logger.info('Daily attendance recalculated', { resortId, employeeId, attendanceDate, status: result.status });
}

export { calculateDailyAttendance, toBusinessDate };
