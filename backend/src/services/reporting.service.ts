import { RowDataPacket } from 'mysql2/promise';
import { getPool, query } from '../config/database';
import { assertValidTablePrefix } from '../database/resort-provisioning/prefix';
import { ForbiddenError, ValidationError } from '../utils/errors';

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  resortIds?: string[] | null; // null = all
  departmentId?: string;
  employeeId?: string;
  status?: string;
}

interface ResortRegistryRow {
  resortId: string;
  resortName: string;
  resortCode: string;
  tablePrefix: string;
  dailyTable: string;
}

async function resolveResortTables(resortIds?: string[] | null): Promise<ResortRegistryRow[]> {
  const params: Record<string, unknown> = {};
  let where = `WHERE r.status = 'active'`;
  if (resortIds && resortIds.length > 0) {
    where += ` AND r.id IN (${resortIds.map((_, i) => `:r${i}`).join(',')})`;
    resortIds.forEach((id, i) => {
      params[`r${i}`] = id;
    });
  } else if (resortIds && resortIds.length === 0) {
    return [];
  }

  const rows = await query<RowDataPacket[]>(
    `SELECT r.id AS resortId, r.name AS resortName, r.code AS resortCode,
            r.table_prefix AS tablePrefix, rtr.tables_json AS tablesJson
     FROM resorts r
     INNER JOIN resort_table_registry rtr ON rtr.resort_id = r.id
     ${where}
     ORDER BY r.name`,
    params
  );

  return rows.map((r) => {
    assertValidTablePrefix(r.tablePrefix);
    const tables = typeof r.tablesJson === 'string' ? JSON.parse(r.tablesJson) : r.tablesJson;
    return {
      resortId: r.resortId,
      resortName: r.resortName,
      resortCode: r.resortCode,
      tablePrefix: r.tablePrefix,
      dailyTable: tables.daily_attendance as string,
    };
  });
}

/**
 * Central consolidated attendance report across resort-specific tables.
 * Clients never pass raw table names — only resort IDs resolved via registry.
 */
export async function consolidatedAttendanceReport(filters: ReportFilters) {
  if (!filters.dateFrom || !filters.dateTo) {
    throw new ValidationError('dateFrom and dateTo are required');
  }

  const resorts = await resolveResortTables(filters.resortIds);
  if (!resorts.length) {
    return { rows: [], summary: emptySummary() };
  }

  const pool = getPool();
  const allRows: RowDataPacket[] = [];

  for (const resort of resorts) {
    assertValidTablePrefix(resort.tablePrefix);
    const clauses = ['da.attendance_date BETWEEN ? AND ?'];
    const params: Array<string | number> = [filters.dateFrom, filters.dateTo];

    if (filters.employeeId) {
      clauses.push('da.employee_id = ?');
      params.push(filters.employeeId);
    }
    if (filters.status) {
      clauses.push('da.status = ?');
      params.push(filters.status);
    }
    if (filters.departmentId) {
      clauses.push('e.department_id = ?');
      params.push(filters.departmentId);
    }

    const sql = `SELECT da.id, da.employee_id AS employeeId, e.employee_code AS employeeCode,
              CONCAT(e.first_name, ' ', e.last_name) AS employeeName,
              e.designation, e.department_id AS departmentId,
              da.attendance_date AS attendanceDate, da.status,
              da.check_in AS checkIn, da.check_out AS checkOut,
              da.working_minutes AS workingMinutes, da.late_minutes AS lateMinutes,
              ? AS resortId, ? AS resortName, ? AS resortCode
       FROM \`${resort.dailyTable}\` da
       INNER JOIN employees e ON e.id = da.employee_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY da.attendance_date, e.last_name`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [
      resort.resortId,
      resort.resortName,
      resort.resortCode,
      ...params,
    ]);
    allRows.push(...rows);
  }

  return { rows: allRows, summary: summarize(allRows) };
}

export async function dashboardStats(accessibleResortIds: string[] | null) {
  const resorts = await resolveResortTables(accessibleResortIds);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const employeeFilter =
    accessibleResortIds === null
      ? ''
      : accessibleResortIds.length
        ? `AND current_resort_id IN (${accessibleResortIds.map(() => '?').join(',')})`
        : 'AND 1=0';

  const empParams = accessibleResortIds ?? [];
  const empRows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM employees WHERE status = 'active' ${employeeFilter}`,
    empParams
  );

  const deviceRows = await query<RowDataPacket[]>(
    `SELECT
       SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS onlineDevices,
       SUM(CASE WHEN status IN ('offline','error','unknown') THEN 1 ELSE 0 END) AS offlineDevices,
       COUNT(*) AS totalDevices
     FROM attendance_devices
     WHERE 1=1 ${
       accessibleResortIds === null
         ? ''
         : accessibleResortIds.length
           ? `AND resort_id IN (${accessibleResortIds.map(() => '?').join(',')})`
           : 'AND 1=0'
     }`,
    empParams
  );

  let present = 0;
  let late = 0;
  let absent = 0;
  let onLeave = 0;
  let missingPunch = 0;

  const pool = getPool();
  for (const resort of resorts) {
    assertValidTablePrefix(resort.tablePrefix);
    const [stats] = await pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS presentCount,
         SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS lateCount,
         SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absentCount,
         SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) AS leaveCount,
         SUM(CASE WHEN status = 'missing_punch' THEN 1 ELSE 0 END) AS missingCount
       FROM \`${resort.dailyTable}\`
       WHERE attendance_date = ?`,
      [today]
    );
    const s = stats[0] ?? {};
    present += Number(s.presentCount ?? 0);
    late += Number(s.lateCount ?? 0);
    absent += Number(s.absentCount ?? 0);
    onLeave += Number(s.leaveCount ?? 0);
    missingPunch += Number(s.missingCount ?? 0);
  }

  const totalEmployees = Number(empRows[0]?.total ?? 0);
  const attendancePct =
    totalEmployees > 0 ? Math.round(((present) / totalEmployees) * 1000) / 10 : 0;

  return {
    date: today,
    totalEmployees,
    present,
    late,
    absent,
    onLeave,
    missingPunch,
    attendancePercentage: attendancePct,
    onlineDevices: Number(deviceRows[0]?.onlineDevices ?? 0),
    offlineDevices: Number(deviceRows[0]?.offlineDevices ?? 0),
    totalDevices: Number(deviceRows[0]?.totalDevices ?? 0),
    resortCount: resorts.length,
  };
}

function emptySummary() {
  return { total: 0, present: 0, absent: 0, late: 0, onLeave: 0, missingPunch: 0 };
}

function summarize(rows: RowDataPacket[]) {
  const summary = emptySummary();
  summary.total = rows.length;
  for (const r of rows) {
    if (r.status === 'present') summary.present++;
    else if (r.status === 'absent') summary.absent++;
    else if (r.status === 'late') {
      summary.late++;
      summary.present++;
    } else if (r.status === 'on_leave') summary.onLeave++;
    else if (r.status === 'missing_punch') summary.missingPunch++;
  }
  return summary;
}

export function assertReportAccess(
  roleCode: string,
  requestedResortIds: string[] | null | undefined,
  allowedLocationIds: string[]
): string[] | null {
  if (roleCode === 'SUPER_ADMIN' || roleCode === 'HO_HR_ADMIN' || roleCode === 'AUDITOR') {
    return requestedResortIds ?? null;
  }
  if (!requestedResortIds || requestedResortIds.length === 0) {
    return allowedLocationIds;
  }
  const unauthorized = requestedResortIds.filter((id) => !allowedLocationIds.includes(id));
  if (unauthorized.length) {
    throw new ForbiddenError('Requested resorts are outside your access scope');
  }
  return requestedResortIds;
}
