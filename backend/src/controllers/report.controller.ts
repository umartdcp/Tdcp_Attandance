import { Request, Response, NextFunction } from 'express';
import * as reportingService from '../services/reporting.service';
import { sendAttendancePdf } from '../services/attendance-pdf';
import { sendSuccess } from '../utils/response';

export async function attendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortIdParam = req.query.resortId as string | undefined;
    const requested = resortIdParam ? [resortIdParam] : undefined;
    const scoped = reportingService.assertReportAccess(
      req.user!.roleCode,
      requested ?? null,
      req.user!.locationIds
    );
    const data = await reportingService.consolidatedAttendanceReport({
      dateFrom: String(req.query.dateFrom),
      dateTo: String(req.query.dateTo),
      resortIds: scoped,
      departmentId: req.query.departmentId as string | undefined,
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
    });
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function attendancePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortIdParam = req.query.resortId as string | undefined;
    const requested = resortIdParam ? [resortIdParam] : undefined;
    const scoped = reportingService.assertReportAccess(
      req.user!.roleCode,
      requested ?? null,
      req.user!.locationIds
    );
    const dateFrom = String(req.query.dateFrom);
    const dateTo = String(req.query.dateTo);
    const data = await reportingService.consolidatedAttendanceReport({
      dateFrom,
      dateTo,
      resortIds: scoped,
      departmentId: req.query.departmentId as string | undefined,
    });
    sendAttendancePdf(res, { dateFrom, dateTo }, data.rows as never);
  } catch (error) {
    next(error);
  }
}
