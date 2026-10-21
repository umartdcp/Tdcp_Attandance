import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate, requirePermissions } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/attendance/pdf', requirePermissions('reports.view'), reportController.attendancePdf);
router.get('/attendance', requirePermissions('reports.view'), reportController.attendance);

export default router;
