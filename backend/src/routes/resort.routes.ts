import { Router } from 'express';
import * as resortController from '../controllers/resort.controller';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createResortSchema, updateResortSchema } from '../validators/resort.validators';

const router = Router();

router.use(authenticate);
router.get('/regions/list', requirePermissions('locations.view'), resortController.regions);
router.get('/', requirePermissions('locations.view'), resortController.list);
router.get('/:id', requirePermissions('locations.view'), resortController.getById);
router.post(
  '/',
  requirePermissions('locations.manage'),
  validate(createResortSchema),
  resortController.create
);
router.patch(
  '/:id',
  requirePermissions('locations.manage'),
  validate(updateResortSchema),
  resortController.update
);

export default router;
