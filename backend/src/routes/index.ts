import { Router } from 'express';
import authRoutes from './auth.routes';
import resortRoutes from './resort.routes';
import employeeRoutes from './employee.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';
import deviceRoutes from './device.routes';
import shiftRoutes from './shift.routes';
import leaveRoutes from './leave.routes';
import healthRoutes from './health.routes';
import userRoutes from './user.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/resorts', resortRoutes);
router.use('/employees', employeeRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/devices', deviceRoutes);
router.use('/shifts', shiftRoutes);
router.use('/leave', leaveRoutes);
router.use('/users', userRoutes);

export default router;
