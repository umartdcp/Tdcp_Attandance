import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { query } from '../config/database';
import * as reportingService from '../services/reporting.service';
import { resolveAccessibleResortIds } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const locationIds = resolveAccessibleResortIds(req.user!, req.query.resortId as string | undefined);
    const data = await reportingService.dashboardStats(locationIds);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function live(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const locationIds = resolveAccessibleResortIds(req.user!, req.query.resortId as string | undefined);
    const stats = await reportingService.dashboardStats(locationIds);
    const params: Record<string, unknown> = {};
    let scope = '';
    if (locationIds && locationIds.length === 0) {
      sendSuccess(res, { stats, recentEmployees: [], recentAttendance: [] });
      return;
    }
    if (locationIds && locationIds.length) {
      scope = `AND e.current_resort_id IN (${locationIds.map((_, i) => `:loc${i}`).join(',')})`;
      locationIds.forEach((id, i) => {
        params[`loc${i}`] = id;
      });
    }
    const recentEmployees = await query<RowDataPacket[]>(
      `SELECT e.id, e.employee_code AS employeeCode,
              CONCAT(e.first_name, ' ', e.last_name) AS name,
              e.device_user_id AS deviceUserId, e.created_at AS createdAt,
              r.name AS resortName, d.name AS departmentName
       FROM employees e
       LEFT JOIN resorts r ON r.id = e.current_resort_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE e.status = 'active' ${scope}
       ORDER BY e.created_at DESC
       LIMIT 8`,
      params
    );
    const attendance = await reportingService.consolidatedAttendanceReport({
      dateFrom: stats.date,
      dateTo: stats.date,
      resortIds: locationIds,
    });
    sendSuccess(res, {
      stats,
      recentEmployees,
      recentAttendance: attendance.rows.slice(0, 12),
    });
  } catch (error) {
    next(error);
  }
}
