import { Router } from 'express';
import { TenantController } from '../controllers/tenant.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();
const controller = new TenantController();

router.use(authenticateToken);
router.use(requireRoles(['SUPER_ADMIN_EVOLUTECH']));

router.post('/tenants', controller.createTenant.bind(controller));

export default router;
