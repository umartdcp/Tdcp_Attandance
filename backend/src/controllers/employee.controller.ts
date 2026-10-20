import { Request, Response, NextFunction } from 'express';
import * as employeeService from '../services/employee.service';
import { resolveAccessibleResortIds, assertLocationAccess } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/response';
import { paramId } from '../utils/params';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const locationIds = resolveAccessibleResortIds(
      req.user!,
      req.query.resortId as string | undefined
    );
    const result = await employeeService.listEmployees({
      resortId: req.query.resortId as string | undefined,
      locationIds,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    });
    sendPaginated(res, result.rows, result.page, result.limit, result.total);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee = await employeeService.getEmployeeById(paramId(req));
    const resortId = employee.current_resort_id as string | null;
    if (resortId) {
      assertLocationAccess(req.user!, resortId);
    }
    sendSuccess(res, employee);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    assertLocationAccess(req.user!, req.body.currentResortId);
    const employee = await employeeService.createEmployee(req.body, req.user!.id);
    sendSuccess(res, employee, 201);
  } catch (error) {
    next(error);
  }
}

export async function transfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    assertLocationAccess(req.user!, req.body.toResortId);
    const employee = await employeeService.transferEmployee(
      paramId(req),
      req.body,
      req.user!.id
    );
    sendSuccess(res, employee);
  } catch (error) {
    next(error);
  }
}
