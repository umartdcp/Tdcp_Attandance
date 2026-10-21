import { Request, Response, NextFunction } from 'express';
import * as employeeService from '../services/employee.service';
import { importAttendanceReport } from '../services/attendance-report.import';
import { resolveAccessibleResortIds, assertLocationAccess } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/response';
import { paramId } from '../utils/params';
import { ValidationError } from '../utils/errors';

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
      departmentId: req.query.departmentId as string | undefined,
      gender: req.query.gender as string | undefined,
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

export async function importReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) throw new ValidationError('Choose an attendance report to upload.');
    if (!/\.(xlsx|xls|csv|pdf)$/i.test(file.originalname)) {
      throw new ValidationError('Upload an Excel, CSV, or PDF attendance report.');
    }
    const result = await importAttendanceReport(
      file.buffer,
      file.originalname,
      req.user!.id,
      resolveAccessibleResortIds(req.user!)
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function departments(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await employeeService.listDepartments());
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

export async function updateGender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee = await employeeService.getEmployeeById(paramId(req));
    const resortId = employee.current_resort_id as string | null;
    if (resortId) assertLocationAccess(req.user!, resortId);
    await employeeService.updateEmployeeGender(String(employee.id), req.body.gender ?? null, req.user!.id);
    sendSuccess(res, { id: employee.id, gender: req.body.gender ?? null });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee = await employeeService.getEmployeeById(paramId(req));
    const resortId = (req.body.currentResortId as string | undefined) || (employee.current_resort_id as string | null);
    if (resortId) assertLocationAccess(req.user!, resortId);
    const updated = await employeeService.updateEmployee(String(employee.id), req.body, req.user!.id);
    sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee = await employeeService.getEmployeeById(paramId(req));
    const resortId = employee.current_resort_id as string | null;
    if (resortId) assertLocationAccess(req.user!, resortId);
    await employeeService.deactivateEmployee(String(employee.id), req.user!.id);
    sendSuccess(res, { id: employee.id, status: 'inactive' });
  } catch (error) {
    next(error);
  }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employee = await employeeService.getEmployeeById(paramId(req));
    const resortId = employee.current_resort_id as string | null;
    if (resortId) assertLocationAccess(req.user!, resortId);
    const updated = await employeeService.updateEmployeeDepartment(
      String(employee.id),
      String(req.body.departmentName ?? ''),
      req.user!.id
    );
    sendSuccess(res, updated);
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
