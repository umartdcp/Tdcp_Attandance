import { Request, Response, NextFunction } from 'express';
import * as reportingService from '../services/reporting.service';
import { resolveAccessibleResortIds } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

export async function stats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const locationIds = resolveAccessibleResortIds(req.user!);
    const data = await reportingService.dashboardStats(locationIds);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}
