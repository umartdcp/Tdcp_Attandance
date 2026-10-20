import { Request, Response, NextFunction } from 'express';
import * as shiftService from '../services/shift.service';
import { sendSuccess } from '../utils/response';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await shiftService.listShifts(req.query.resortId as string | undefined);
    sendSuccess(res, rows);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await shiftService.createShift(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}
