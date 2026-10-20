import { Router } from 'express';
import * as shiftController from '../controllers/shift.controller';
import { authenticate, requirePermissions } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/', requirePermissions('shifts.manage'), shiftController.list);
router.post('/', requirePermissions('shifts.manage'), shiftController.create);
export default router;
