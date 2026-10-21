import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, requirePermissions } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserRoleSchema } from '../validators/user.validators';

const router = Router();

router.use(authenticate);
router.use(requirePermissions('users.manage'));
router.get('/roles', userController.roles);
router.get('/', userController.list);
router.post('/', validate(createUserSchema), userController.create);
router.patch('/:id/role', validate(updateUserRoleSchema), userController.updateRole);

export default router;
