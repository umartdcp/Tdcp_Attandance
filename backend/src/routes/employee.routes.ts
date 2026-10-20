import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createEmployeeSchema, transferEmployeeSchema } from '../validators/employee.validators';

const router = Router();

router.use(authenticate);
router.get('/', requirePermissions('employees.view'), employeeController.list);
router.get('/:id', requirePermissions('employees.view'), employeeController.getById);
router.post(
  '/',
  requirePermissions('employees.manage'),
  validate(createEmployeeSchema),
  employeeController.create
);
router.post(
  '/:id/transfer',
  requirePermissions('employees.manage'),
  validate(transferEmployeeSchema),
  employeeController.transfer
);

export default router;
