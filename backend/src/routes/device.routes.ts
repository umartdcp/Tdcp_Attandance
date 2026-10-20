import { Router } from 'express';
import * as deviceController from '../controllers/device.controller';
import { authenticate, requirePermissions } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/adapters', requirePermissions('devices.manage'), deviceController.listAdapters);
router.get('/', requirePermissions('devices.manage'), deviceController.listDevices);
router.post('/', requirePermissions('devices.manage'), deviceController.createDevice);
router.post(
  '/:id/test-connection',
  requirePermissions('devices.sync'),
  deviceController.testConnection
);
router.post('/:id/import-csv', requirePermissions('devices.sync'), deviceController.importCsv);

export default router;
