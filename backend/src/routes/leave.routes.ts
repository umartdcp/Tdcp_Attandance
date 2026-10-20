import { Router } from 'express';
import * as leaveController from '../controllers/leave.controller';
import { authenticate, requirePermissions } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/types', leaveController.types);
router.get('/balances', leaveController.balances);
router.post('/apply', requirePermissions('leave.apply'), leaveController.apply);
router.post('/review', requirePermissions('leave.approve'), leaveController.review);
export default router;
