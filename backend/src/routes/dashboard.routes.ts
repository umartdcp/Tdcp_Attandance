import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate, requirePermissions } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/stats', requirePermissions('attendance.view'), dashboardController.stats);
router.get('/live', requirePermissions('attendance.view'), dashboardController.live);

export default router;
