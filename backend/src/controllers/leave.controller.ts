import { Request, Response, NextFunction } from 'express';
import * as leaveService from '../services/leave.service';
import { assertLocationAccess } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

export async function types(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await leaveService.listLeaveTypes());
  } catch (error) {
    next(error);
  }
}

export async function balances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employeeId = String(req.query.employeeId ?? req.user!.employeeId ?? '');
    if (!employeeId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'employeeId is required' },
      });
      return;
    }
    sendSuccess(res, await leaveService.getBalances(employeeId, Number(req.query.year) || undefined));
  } catch (error) {
    next(error);
  }
}

export async function apply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    assertLocationAccess(req.user!, req.body.resortId);
    const result = await leaveService.applyLeave(req.body, req.user!.id);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function review(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    assertLocationAccess(req.user!, req.body.resortId);
    const result = await leaveService.reviewLeave(
      {
        resortId: req.body.resortId,
        leaveRequestId: req.body.leaveRequestId,
        status: req.body.status,
        reviewNotes: req.body.reviewNotes,
      },
      req.user!.id
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
