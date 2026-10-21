import { Router } from 'express';
import * as deviceController from '../controllers/device.controller';
import { authenticate, requireAnyPermission, requirePermissions } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/adapters', requirePermissions('devices.manage'), deviceController.listAdapters);
router.get(
  '/connect-info',
  requireAnyPermission('devices.manage', 'employees.manage'),
  deviceController.connectInfo
);
router.get('/', requireAnyPermission('devices.manage', 'employees.manage'), deviceController.listDevices);
router.post('/', requirePermissions('devices.manage'), deviceController.createDevice);
router.get('/:id/next-user-id', requirePermissions('employees.manage'), deviceController.nextUserId);
router.post('/:id/capture-finger', requirePermissions('employees.manage'), deviceController.captureFinger);
router.post(
  '/:id/test-connection',
  requirePermissions('devices.sync'),
  deviceController.testConnection
);
router.post('/:id/sync', requirePermissions('devices.sync'), deviceController.syncDevice);
router.post('/:id/import-csv', requirePermissions('devices.sync'), deviceController.importCsv);

export default router;
