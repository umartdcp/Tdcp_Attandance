import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import { getPool, query } from '../config/database';
import { getResortTableMap } from '../database/resort-provisioning/provisioner';
import { ingestNormalizedRecord, recalculateDailyAttendance } from '../attendance-engine';
import { ValidationError } from '../utils/errors';
import { writeAuditLog } from './audit.service';
import { updateEmployeeFromReport } from './employee.service';
import { ParsedAttendanceRow, canonicalDepartment, parseAttendanceMatrix } from './attendance-report.parse';

export interface ReportImportResult {
  updated: number;
  names: number;
  departments: number;
  checkIns: number;
  checkOuts: number;
  unmatched: number;
  unmatchedSamples: string[];
}

interface MachineEmployee {
  id: string;
  deviceUserId: string;
  firstName: string;
  lastName: string;
  resortId: string | null;
  normId: string;
  normName: string;
}

export async function importAttendanceReport(
  buffer: Buffer,
  filename: string,
  actorUserId: string,
  allowedResortIds: string[] | null
): Promise<ReportImportResult> {
  const rows = await readReport(buffer, filename);
  if (!rows.length) {
    throw new ValidationError(
      'No attendance table was found. Upload the Excel, CSV, or PDF report with name, department, and check-in columns.'
    );
  }

  const employees = await loadMachineEmployees();
  const byId = new Map<string, MachineEmployee>();
  const byName = new Map<string, MachineEmployee[]>();
  employees.forEach((employee) => {
    byId.set(employee.normId, employee);
    const list = byName.get(employee.normName) ?? [];
    list.push(employee);
    byName.set(employee.normName, list);
  });

  const devices = await query<RowDataPacket[]>(
    `SELECT id, resort_id AS resortId FROM attendance_devices`
  );
  const today = todayKarachi();
  const result: ReportImportResult = {
    updated: 0,
    names: 0,
    departments: 0,
    checkIns: 0,
    checkOuts: 0,
    unmatched: 0,
    unmatchedSamples: [],
  };
  const seen = new Set<string>();

  for (const row of rows) {
    const employee = matchEmployee(row, byId, byName);
    if (!employee) {
      result.unmatched += 1;
      if (result.unmatchedSamples.length < 8) {
        result.unmatchedSamples.push(row.name || row.userId || 'Unknown row');
      }
      continue;
    }
    if (employee.resortId && allowedResortIds && !allowedResortIds.includes(employee.resortId)) continue;

    const date = toYmd(row.date, today);
    const seenKey = `${employee.id}|${date}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);

    const name = splitName(row.name, employee.lastName);
    const department = canonicalDepartment(row.department);
    const gender = normalizeGender(row.gender);
    await updateEmployeeFromReport(employee.id, {
      firstName: name?.firstName,
      lastName: name?.lastName,
      departmentName: department || undefined,
      designation: row.designation || undefined,
      gender,
      shiftStart: row.shiftStart || undefined,
      shiftEnd: row.shiftEnd || undefined,
    });

    const deviceId = deviceFor(employee.resortId, devices);
    if (deviceId && employee.resortId && (row.checkIn || row.checkOut || row.status || row.lateMinutes != null || row.earlyMinutes != null)) {
      await saveAttendance(employee, deviceId, date, row);
    }

    result.updated += 1;
    if (name) result.names += 1;
    if (department) result.departments += 1;
    if (row.checkIn) result.checkIns += 1;
    if (row.checkOut) result.checkOuts += 1;
  }

  await writeAuditLog({
    actorUserId,
    action: 'employee.report_import',
    entityType: 'employee',
    afterData: { filename, ...result },
  });

  return result;
}

async function readReport(buffer: Buffer, filename: string): Promise<ParsedAttendanceRow[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    const matrix = parsed.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\t+|\s{2,}/).map((cell) => cell.trim()));
    return parseAttendanceMatrix(matrix);
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const rows: ParsedAttendanceRow[] = [];
  workbook.SheetNames.forEach((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
    });
    rows.push(...parseAttendanceMatrix(matrix.map((row) => (row ?? []).map((cell) => String(cell ?? '')))));
  });
  return rows;
}

async function loadMachineEmployees(): Promise<MachineEmployee[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT id, device_user_id AS deviceUserId, first_name AS firstName, last_name AS lastName,
            current_resort_id AS resortId
     FROM employees
     WHERE device_user_id IS NOT NULL AND device_user_id <> '' AND status = 'active'`
  );
  return rows.map((row) => ({
    id: String(row.id),
    deviceUserId: String(row.deviceUserId),
    firstName: String(row.firstName ?? ''),
    lastName: String(row.lastName ?? ''),
    resortId: row.resortId ? String(row.resortId) : null,
    normId: normId(String(row.deviceUserId)),
    normName: normName(`${row.firstName ?? ''} ${row.lastName ?? ''}`),
  }));
}

function matchEmployee(
  row: ParsedAttendanceRow,
  byId: Map<string, MachineEmployee>,
  byName: Map<string, MachineEmployee[]>
): MachineEmployee | null {
  if (row.userId) {
    const byMachineId = byId.get(normId(row.userId));
    if (byMachineId) return byMachineId;
  }
  if (!row.name) return null;
  const matches = byName.get(normName(row.name)) ?? [];
  return matches.length === 1 ? matches[0] : null;
}

function deviceFor(resortId: string | null, devices: RowDataPacket[]): string | null {
  const sameSite = devices.find((device) => resortId && String(device.resortId) === resortId);
  return String((sameSite ?? devices[0])?.id ?? '') || null;
}

async function saveAttendance(
  employee: MachineEmployee,
  deviceId: string,
  date: string,
  row: ParsedAttendanceRow
): Promise<void> {
  if (!employee.resortId) return;
  const punches: Array<{ time: string; direction: 'in' | 'out' }> = [];
  if (row.checkIn) punches.push({ time: row.checkIn, direction: 'in' });
  if (row.checkOut) punches.push({ time: row.checkOut, direction: 'out' });

  for (const punch of punches) {
    await ingestNormalizedRecord({
      employeeId: employee.id,
      deviceUserId: employee.deviceUserId,
      deviceId,
      resortId: employee.resortId,
      punchTime: new Date(`${date}T${punch.time}+05:00`),
      punchDirection: punch.direction,
      verificationMethod: 'report',
      sourceRecordId: `report|${employee.deviceUserId}|${date}|${punch.direction}`,
      syncedAt: new Date(),
      sourcePayload: { source: 'attendance-report', name: row.name, department: row.department },
      processingStatus: 'pending',
    });
  }

  if (punches.length) {
    await recalculateDailyAttendance(employee.resortId, employee.id, date, {
      isOnLeave: reportStatus(row.status) === 'on_leave',
    });
  }

  await overlayDaily(employee, date, row);
}

async function overlayDaily(employee: MachineEmployee, date: string, row: ParsedAttendanceRow): Promise<void> {
  if (!employee.resortId) return;
  const tables = await getResortTableMap(employee.resortId);
  const pool = getPool();
  const checkIn = row.checkIn ? new Date(`${date}T${row.checkIn}+05:00`) : null;
  const checkOut = row.checkOut ? new Date(`${date}T${row.checkOut}+05:00`) : null;
  const status = reportStatus(row.status);
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM \`${tables.daily_attendance}\` WHERE employee_id = ? AND attendance_date = ? LIMIT 1`,
    [employee.id, date]
  );

  if (existing.length) {
    await pool.execute(
      `UPDATE \`${tables.daily_attendance}\`
       SET check_in = COALESCE(?, check_in),
           check_out = COALESCE(?, check_out),
           late_minutes = COALESCE(?, late_minutes),
           early_departure_minutes = COALESCE(?, early_departure_minutes),
           status = COALESCE(?, status),
           calculated_at = NOW()
       WHERE employee_id = ? AND attendance_date = ?`,
      [checkIn, checkOut, row.lateMinutes, row.earlyMinutes, status, employee.id, date]
    );
    return;
  }

  await pool.execute(
    `INSERT INTO \`${tables.daily_attendance}\` (
      id, employee_id, attendance_date, check_in, check_out, late_minutes,
      early_departure_minutes, status, calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      randomUUID(),
      employee.id,
      date,
      checkIn,
      checkOut,
      row.lateMinutes ?? 0,
      row.earlyMinutes ?? 0,
      status ?? (checkIn ? 'present' : 'absent'),
    ]
  );
}

function reportStatus(value: string): string | null {
  const text = value.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  if (!text) return null;
  if (text === 'p' || text.includes('present')) return 'present';
  if (text === 'l' || text.includes('late')) return 'late';
  if (text === 'a' || text.includes('absent')) return 'absent';
  if (text.includes('leave')) return 'on_leave';
  if (text.includes('holiday')) return 'holiday';
  if (text.includes('weekly')) return 'weekly_off';
  return null;
}

function splitName(full: string, existingLast: string): { firstName: string; lastName: string } | null {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: existingLast && existingLast !== '-' ? existingLast : '-' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizeGender(value: string): 'male' | 'female' | 'other' | undefined {
  const text = value.toLowerCase().trim();
  if (text === 'm' || text === 'male') return 'male';
  if (text === 'f' || text === 'female') return 'female';
  if (text === 'other') return 'other';
  return undefined;
}

function normId(value: string): string {
  const text = value.trim().replace(/\.0$/, '');
  return /^\d+$/.test(text) ? String(Number(text)) : text.toLowerCase();
}

function normName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function toYmd(value: string, fallback: string): string {
  const text = value.trim();
  if (!text) return fallback;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parts = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (parts) {
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    const day = second > 12 ? second : first;
    const month = second > 12 ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${parts[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return fallback;
}

function todayKarachi(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    }).format(new Date());
}
