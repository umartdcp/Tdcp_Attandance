import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import * as employeeController from '../controllers/employee.controller';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ValidationError } from '../utils/errors';
import { createEmployeeSchema, transferEmployeeSchema, updateDepartmentSchema, updateEmployeeSchema, updateGenderSchema } from '../validators/employee.validators';

const router = Router();
const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function receiveReport(req: Request, res: Response, next: NextFunction): void {
  reportUpload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
    next(new ValidationError(code === 'LIMIT_FILE_SIZE' ? 'The report must be 8 MB or smaller.' : 'The report could not be read.'));
  });
}

router.use(authenticate);
router.get('/departments', requirePermissions('employees.view'), employeeController.departments);
router.post('/import-report', requirePermissions('employees.manage'), receiveReport, employeeController.importReport);
router.get('/', requirePermissions('employees.view'), employeeController.list);
router.get('/:id', requirePermissions('employees.view'), employeeController.getById);
router.post(
  '/',
  requirePermissions('employees.manage'),
  validate(createEmployeeSchema),
  employeeController.create
);
router.patch(
  '/:id/gender',
  requirePermissions('employees.manage'),
  validate(updateGenderSchema),
  employeeController.updateGender
);
router.patch(
  '/:id',
  requirePermissions('employees.manage'),
  validate(updateEmployeeSchema),
  employeeController.update
);
router.delete('/:id', requirePermissions('employees.manage'), employeeController.remove);
router.patch(
  '/:id/department',
  requirePermissions('employees.manage'),
  validate(updateDepartmentSchema),
  employeeController.updateDepartment
);
router.post(
  '/:id/transfer',
  requirePermissions('employees.manage'),
  validate(transferEmployeeSchema),
  employeeController.transfer
);

export default router;
